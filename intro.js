/* ==========================================================================
   INTRO — « La lymphe se remet à circuler »
   Première visite uniquement. Un rideau vert encre (le poids, la pièce tamisée
   du cabinet) sur lequel un réseau lymphatique sort du flou, puis se remplit :
   le liquide part des extrémités, remonte les collecteurs vers les ganglions
   et s'évacue. Quand il est drainé, la lumière s'ouvre en fondu depuis le
   ganglion et révèle le site (la légèreté). Le réseau reste ensuite derrière
   le texte du hero, en circulation lente — la continuité entre rideau et page.

   Tout est pensé pour la douceur : mise au point progressive, léger recul de
   caméra, second réseau flou en arrière-plan qui dérive, reflets diffus,
   ouverture sans bord net. Rien ne démarre ni ne s'arrête d'un coup.

   Rendu WebGL2 : chaque vaisseau est un tube (profil cylindrique calculé par
   pixel) avec valvules, contractions péristaltiques, lymphocytes en suspension
   et reflets. Un pré-passage de profondeur fusionne les tubes aux embranchements.

   Aucun WebGL2, mouvement réduit demandé, ou page sans hero → rien ne se
   passe, le site s'affiche normalement. ?intro dans l'URL force le rideau.
   ========================================================================== */
(function(){
  const html = document.documentElement;
  const hero = document.querySelector('.hero');
  const heroContent = document.querySelector('.hero-content');
  const rideau = document.querySelector('.intro-rideau');
  const marque = document.querySelector('.intro-marque');
  const avecRideau = html.classList.contains('intro-on') && !!rideau && !!marque;
  window.introPrise = true; // désarme le filet de sécurité posé dans le <head>

  function libererPage(){
    html.classList.remove('intro-on');
    if(rideau) rideau.remove();
    if(marque) marque.remove();
  }

  if(!hero || !heroContent || window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    libererPage(); return;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'lymphe-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha:true, premultipliedAlpha:true, antialias:true, depth:true });
  if(!gl){ libererPage(); return; }

  try { localStorage.setItem('intro_vue', '1'); } catch(e) {}
  hero.prepend(canvas);
  if(avecRideau){
    canvas.classList.add('au-dessus'); html.classList.add('intro-verrou');
    rideau.classList.add('actif'); marque.classList.add('actif');
    if('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  } else {
    libererPage();
  }

  /* ---------- Shaders ---------------------------------------------------- */

  const COMMUN = `#version 300 es
  precision highp float;
  uniform vec2 uRes;       // taille du hero, px CSS
  uniform float uTime, uFront, uTheme, uAlpha, uPass, uWmax, uFlou;
  uniform vec3 uOpen;      // centre (px) + rayon de l'ouverture de lumière
  uniform float uFondu;    // largeur du fondu de l'ouverture (px)
  uniform vec4 uKeep;      // zone conservée une fois posé (x0,y0,x1,y1)
  uniform float uKeepMix;
  uniform vec4 uClear;     // zone du nom pendant le rideau (atténuée)

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // Thème par pixel : sombre (rideau) → clair (page), l'ouverture balaie depuis le ganglion
  float themeAt(vec2 p){
    float d = length(p - uOpen.xy);
    return max(uTheme, 1.0 - smoothstep(uOpen.z - uFondu, uOpen.z, d));
  }
  float masqueAt(vec2 p, float th){
    float f = 110.0;
    float k = smoothstep(uKeep.x - 10.0, uKeep.x + f*0.3, p.x) * (1.0 - smoothstep(uKeep.z - f, uKeep.z, p.x))
            * smoothstep(uKeep.y, uKeep.y + f, p.y) * (1.0 - smoothstep(uKeep.w - f, uKeep.w, p.y));
    float keep = mix(1.0, k, uKeepMix * th);
    vec2 c = clamp(p, uClear.xy, uClear.zw);
    float nom = mix(0.2, 1.0, smoothstep(0.0, 80.0, length(p - c)));
    return keep * mix(nom, 1.0, th);
  }
  // Composition « over » en alpha prémultiplié
  void over(inout vec4 acc, vec3 col, float a){
    a = clamp(a, 0.0, 1.0);
    acc = vec4(col * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a));
  }
  const vec3 LUM = vec3(-0.387, -0.602, 0.698); // lumière douce venant d'en haut à gauche
  `;

  const VS_TUBE = `#version 300 es
  in vec2 aPos; in vec2 aNor; in float aSide; in float aP; in float aW; in float aSeed; in float aTip;
  uniform vec2 uRes; uniform float uTime, uFlou;
  uniform vec3 uZoom;  // centre (px) + facteur du léger recul de caméra
  uniform vec2 uDrift; // dérive lente (réseau d'arrière-plan)
  out float vSide; out float vP; out float vW; out float vSeed; out vec2 vNor; out vec2 vPos;
  void main(){
    // Lymphangions : renflement entre deux valvules, pincement au niveau de la valvule
    float L = aW * 2.4 + 12.0;
    float ph = fract(aP / L);
    float valve = 0.8 + 0.2 * pow(sin(3.14159 * ph), 0.6);
    // Contraction péristaltique lente, qui avance vers le ganglion (P décroissant)
    float peri = 1.0 + 0.07 * sin(6.28318 * (aP / 240.0 + uTime * 0.22));
    float w = max(aW * valve * peri * aTip, 0.6) * uZoom.z;
    float halo = 2.2 + uFlou * 1.8;   // le flou déborde du tube : on élargit la bande dessinée
    vec2 centre = (aPos - uZoom.xy) * uZoom.z + uZoom.xy + uDrift;
    vec2 pos = centre + aNor * aSide * w * 0.5 * halo;
    vSide = aSide * halo; vP = aP; vW = w; vSeed = aSeed; vNor = aNor; vPos = pos;
    vec2 clip = pos / uRes * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  }`;

  const FS_TUBE = COMMUN + `
  in float vSide; in float vP; in float vW; in float vSeed; in vec2 vNor; in vec2 vPos;
  out vec4 o;

  float lymphocytes(float along, float a, float w, float vitesse, float cell, float seed){
    float q = (along + uTime * vitesse) / cell;
    float id = floor(q);
    float r = hash(vec2(id, seed));
    if(r > 0.55) return 0.0;
    float c = (0.2 + 0.6 * hash(vec2(id, seed + 7.1))) * cell;
    float ac = (hash(vec2(id, seed + 3.3)) - 0.5) * 1.1;
    float rad = 1.0 + 1.3 * hash(vec2(id, seed + 5.7));
    vec2 d = vec2(fract(q) * cell - c, (a - ac) * w * 0.5);
    return smoothstep(rad + 1.2, rad * 0.2, length(d));
  }

  void main(){
    float s = vSide;
    float a = abs(s);
    float h = sqrt(max(1.0 - a*a, 0.0));
    float depth = 0.9 - 0.45 * h * (vW / uWmax);

    if(uPass < 0.5){             // pré-passage : profondeur seule, tube plein
      if(a > 1.0) discard;
      gl_FragDepth = depth;
      o = vec4(0.0);
      return;
    }

    float th = themeAt(vPos);
    float m = masqueAt(vPos, th) * uAlpha;
    float plein = smoothstep(uFront, uFront + 110.0, vP);
    float menisque = exp(-pow((vP - uFront - 55.0) / 55.0, 2.0));

    vec3 paroiD = vec3(0.93, 0.80, 0.74);   // rosée
    vec3 paroiC = vec3(0.29, 0.42, 0.39);   // encre-2
    vec3 lympheD = vec3(0.97, 0.87, 0.68);
    vec3 lympheC = vec3(0.66, 0.51, 0.31);  // or
    vec3 cellD = vec3(1.0, 0.96, 0.88);
    vec3 cellC = vec3(0.54, 0.40, 0.21);    // or-texte

    // Version défocalisée : profil gaussien, sans reflet (mise au point, arrière-plan)
    float etale = 1.0 + uFlou * 1.3;
    float g = exp(-pow(a / etale, 2.0) * 2.0) / etale;
    vec4 flou = vec4(mix(lympheD, lympheC, th), 1.0) * g * (0.14 + 0.32 * plein);

    vec4 net;
    if(a > 1.0){                 // halo : lueur autour du vaisseau rempli (rideau uniquement)
      gl_FragDepth = 0.999;
      float lueur = exp(-(a - 1.0) * 2.4) * (plein * 0.16 + menisque * 0.14) * (1.0 - th);
      net = vec4(vec3(0.95, 0.83, 0.62) * lueur, lueur);
    } else {
      gl_FragDepth = depth;
      vec3 n = normalize(vec3(vNor * s, h));
      float refl = max(dot(reflect(-LUM, n), vec3(0.0, 0.0, 1.0)), 0.0);
      float diff = max(dot(n, LUM), 0.0);
      float rim = pow(1.0 - h, 2.2);
      float coeur = pow(h, 6.0);

      net = vec4(0.0);
      // Paroi translucide : visible surtout sur les bords (Fresnel)
      over(net, mix(paroiD, paroiC, th), rim * mix(0.42, 0.28, th) + mix(0.05, 0.03, th));
      // Lymphe : liquide clair, légèrement opalescent — on voit le fond au travers
      over(net, mix(lympheD, lympheC, th), plein * (0.1 + 0.26 * h) * (0.8 + 0.3 * diff));
      // Réfraction : liseré lumineux juste à l'intérieur de la paroi, plus marqué côté lumière
      float lisere = exp(-pow((a - 0.78) / 0.12, 2.0)) * (0.6 + 0.4 * sign(-s * dot(vNor, LUM.xy)));
      over(net, mix(vec3(1.0, 0.93, 0.8), lympheC, th), plein * lisere * mix(0.38, 0.22, th));
      // Effet de lentille : ligne claire et diffuse au cœur du liquide
      over(net, mix(vec3(1.0, 0.95, 0.86), vec3(1.0, 0.98, 0.94), th), plein * coeur * 0.26);
      // Front de remplissage : une onde tiède, pas une étincelle
      over(net, lympheD, menisque * 0.3 * h * (1.0 - th));
      // Lymphocytes en suspension, deux vitesses pour la profondeur
      float cells = lymphocytes(vP, s, vW, 24.0, 30.0, vSeed) + 0.6 * lymphocytes(vP, s, vW, 15.0, 19.0, vSeed + 11.0);
      over(net, mix(cellD, cellC, th), cells * plein * mix(0.6, 0.38, th) * smoothstep(1.0, 0.7, a));
      // Reflets diffus : une brillance large et un reflet adouci
      over(net, vec3(1.0), pow(refl, 6.0) * 0.1 + pow(refl, 38.0) * mix(0.5, 0.45, th));
    }

    o = mix(net, flou, uFlou) * m;
  }`;

  const VS_NOEUD = `#version 300 es
  in vec2 aCorner;
  uniform vec2 uRes; uniform vec2 uCenter; uniform float uR;
  out vec2 vLocal; out vec2 vPos;
  void main(){
    vec2 pos = uCenter + aCorner * uR * 3.4;
    vLocal = aCorner * uR * 3.4; vPos = pos;
    vec2 clip = pos / uRes * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  }`;

  const FS_NOEUD = COMMUN + `
  in vec2 vLocal; in vec2 vPos;
  uniform float uR, uAng, uPN;
  out vec4 o;

  float bruit(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0 - 2.0*f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }

  void main(){
    // Repère du ganglion : forme de haricot, hile (creux) tourné vers le vaisseau efférent
    float c = cos(uAng), sn = sin(uAng);
    vec2 p = mat2(c, -sn, sn, c) * vLocal;
    vec2 e = p / vec2(uR, uR * 0.72);
    float th0 = atan(e.y, e.x);
    float hile = 1.0 - 0.2 * exp(-pow(th0, 2.0) / 0.25);
    float rho = length(e) / hile;
    float h = sqrt(max(1.0 - rho*rho, 0.0));

    if(uPass < 0.5){
      if(rho > 1.0) discard;
      gl_FragDepth = 0.4 - 0.3 * h;
      o = vec4(0.0);
      return;
    }

    float th = themeAt(vPos);
    float m = masqueAt(vPos, th) * uAlpha;
    float plein = smoothstep(uPN + uR * 2.0, uPN - uR * 2.0, uFront);
    float souffle = 0.88 + 0.12 * sin(uTime * 1.2566); // respiration 5 s, comme l'icône goutte du site
    vec3 lymphe = mix(vec3(0.97, 0.86, 0.68), vec3(0.66, 0.51, 0.31), th);

    float etale = 1.0 + uFlou * 0.9;
    float g = exp(-pow(rho / etale, 2.0) * 1.6) / etale;
    vec4 flou = vec4(lymphe, 1.0) * g * (0.2 + 0.4 * plein);

    vec4 net;
    if(rho > 1.0){
      gl_FragDepth = 0.999;
      // Lueur large et tiède qui respire : le ganglion « s'allume » sans éblouir
      float lueur = exp(-(rho - 1.0) * 1.5) * plein * 0.3 * souffle * (1.0 - th);
      net = vec4(vec3(0.97, 0.85, 0.64) * lueur, lueur);
    } else {
      gl_FragDepth = 0.4 - 0.3 * h;
      vec2 dir = length(e) > 0.0 ? normalize(e) : vec2(0.0);
      vec3 n = normalize(vec3(mat2(c, sn, -sn, c) * dir * rho, h));
      float refl = max(dot(reflect(-LUM, n), vec3(0.0, 0.0, 1.0)), 0.0);
      float diff = max(dot(n, LUM), 0.0);
      float rim = pow(1.0 - h, 2.0);
      // Follicules du cortex : granulation douce, plus marquée en périphérie
      float fol = bruit(p / (uR * 0.22) + 3.0) * 0.6 + bruit(p / (uR * 0.1)) * 0.4;
      fol = smoothstep(0.5, 0.85, fol) * smoothstep(0.25, 0.85, rho);

      net = vec4(0.0);
      over(net, mix(vec3(0.93, 0.78, 0.72), vec3(0.29, 0.42, 0.39), th), rim * mix(0.5, 0.35, th) + 0.07);
      over(net, lymphe, plein * mix(0.35 + 0.45*h, 0.16 + 0.28*h, th) * (0.75 + 0.35*diff) * souffle);
      over(net, mix(vec3(0.99, 0.93, 0.82), vec3(0.54, 0.40, 0.21), th), fol * plein * mix(0.26, 0.22, th));
      over(net, vec3(1.0), pow(refl, 5.0) * 0.1 + pow(refl, 24.0) * 0.4);
    }
    o = mix(net, flou, uFlou) * m;
  }`;

  function compiler(vs, fs){
    const prog = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    });
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const u = {};
    const nb = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for(let i = 0; i < nb; i++){ const nom = gl.getActiveUniform(prog, i).name; u[nom] = gl.getUniformLocation(prog, nom); }
    return { prog, u };
  }

  let pTube, pNoeud;
  try {
    pTube = compiler(VS_TUBE, FS_TUBE);
    pNoeud = compiler(VS_NOEUD, FS_NOEUD);
  } catch(err) {
    canvas.remove(); libererPage(); return;
  }

  /* ---------- Géométrie du réseau --------------------------------------- */

  // Hasard reproductible : même composition à chaque visite, à chaque taille d'écran
  function aleaSeed(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const STEP = 4;

  // Fait pousser un vaisseau depuis (x, y) en marche aléatoire lissée, avec ramifications
  function croissance(rnd, chemins, bornes, x, y, angle, largeur, P0, prof, longMax, probas){
    const pts = [], P = [], w = [], tip = [];
    let a = angle, da = 0, s = 0;
    const enfants = [];
    while(true){
      pts.push({ x, y }); P.push(P0 + s); w.push(largeur * (1 - 0.3 * Math.min(s / 900, 1)));
      if(x < bornes.x0 || x > bornes.x1 || y < bornes.y0 || y > bornes.y1 || s > longMax) break;
      da += (rnd() - 0.5) * 0.022; da *= 0.97;
      a += da + (angle - a) * 0.008;
      x += Math.cos(a) * STEP; y += Math.sin(a) * STEP; s += STEP;
      if(s > 70 && rnd() < (probas[prof] || 0)){
        const cote = rnd() < 0.5 ? -1 : 1;
        enfants.push([x, y, a + cote * (0.45 + rnd() * 0.5), largeur * (prof === 0 ? 0.64 : 0.72), P0 + s, prof + 1,
                      prof === 0 ? 260 + rnd() * 600 : prof === 1 ? 70 + rnd() * 180 : 30 + rnd() * 70]);
      }
    }
    // Extrémité borgne des petits capillaires : effilée
    const n = pts.length;
    for(let i = 0; i < n; i++){
      const reste = (n - 1 - i) * STEP;
      tip.push(s <= longMax ? 1 : 0.35 + 0.65 * Math.min(reste / 26, 1));
    }
    chemins.push({ pts, P, w, tip });
    enfants.forEach(e => croissance(rnd, chemins, bornes, ...e, probas));
  }

  // Tampons : x, y, nx, ny, côté, P, largeur, graine, effilement
  function empaqueter(chemins, graine0){
    let nbV = 0; chemins.forEach(c => nbV += c.pts.length * 2);
    const data = new Float32Array(nbV * 9);
    const idx = [];
    let v = 0, Pmax = 0, wmax = 0;
    chemins.forEach((c, ci) => {
      const n = c.pts.length, base = v;
      const graine = graine0 + ci * 1.37;
      for(let i = 0; i < n; i++){
        const a = c.pts[Math.max(i - 1, 0)], b = c.pts[Math.min(i + 1, n - 1)];
        let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        for(const cote of [-1, 1]){
          data.set([c.pts[i].x, c.pts[i].y, -ty, tx, cote, c.P[i], c.w[i], graine, c.tip[i]], v * 9);
          v++;
        }
        Pmax = Math.max(Pmax, c.P[i]); wmax = Math.max(wmax, c.w[i]);
        if(i < n - 1){ const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
    });
    return { data, idx: new Uint32Array(idx), Pmax, wmax: wmax * 1.3 };
  }

  function construire(W, H, vw, vh){
    const rnd = aleaSeed(1987);
    const vmin = Math.min(vw, vh);
    const w0 = Math.max(9, Math.min(19, vmin * 0.021));
    const chemins = [];

    // Chaîne de ganglions : deux relais bas (N3, N4) → ganglion central (N1) → N2 → sortie
    // vers le haut (vers la clavicule, où la lymphe rejoint la circulation).
    const N1 = { x: vw * 0.5, y: vh * 0.36, r: Math.max(24, Math.min(58, vmin * 0.068)) };
    const N2 = { x: vw * 0.585, y: vh * 0.13, r: N1.r * 0.6 };
    const N3 = { x: vw * 0.2, y: vh * 0.64, r: N1.r * 0.7 };
    const N4 = { x: vw * 0.82, y: vh * 0.7, r: N1.r * 0.55 };
    const sortie = { x: vw * 0.62, y: -60 };

    function courbe(A, B, flexion, largeur, Pfin){
      const pts = [];
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
      const cx = (A.x + B.x) / 2 - dy / len * flexion, cy = (A.y + B.y) / 2 + dx / len * flexion;
      const n = Math.ceil(len / STEP);
      for(let i = 0; i <= n; i++){
        const t = i / n, u = 1 - t;
        pts.push({ x: u*u*A.x + 2*u*t*cx + t*t*B.x, y: u*u*A.y + 2*u*t*cy + t*t*B.y });
      }
      // P = distance restante jusqu'à la sortie, le long du trajet
      let s = 0; const P = new Array(pts.length);
      P[pts.length - 1] = Pfin;
      for(let i = pts.length - 2; i >= 0; i--){ s += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y); P[i] = Pfin + s; }
      chemins.push({ pts, P, w: pts.map(() => largeur), tip: pts.map(() => 1) });
      return Pfin + s;
    }

    N2.P = courbe(N2, sortie, 30, w0 * 1.15, 0);          N2.cible = sortie;
    N1.P = courbe(N1, N2, -40, w0 * 1.1, N2.P);           N1.cible = N2;
    N3.P = courbe(N3, N1, 70, w0 * 0.95, N1.P);           N3.cible = N1;
    N4.P = courbe(N4, N1, -60, w0 * 0.9, N1.P);           N4.cible = N1;

    // Collecteurs afférents : la lymphe arrive des côtés et du bas vers les ganglions
    const bornes = { x0: -80, x1: W + 80, y0: -80, y1: H + 80 };
    const deg = Math.PI / 180;
    [[N1, -165, 1], [N1, 18, 1.05], [N1, -20, 0.85],
     [N2, -155, 0.75], [N2, -25, 0.7], [N2, 195, 0.7],
     [N3, 178, 0.95], [N3, 140, 1], [N3, 102, 0.9], [N3, 212, 0.8],
     [N4, 4, 0.9], [N4, 58, 0.95], [N4, 98, 0.85], [N4, -28, 0.75]].forEach(([N, angDeg, k]) => {
      const a = angDeg * deg;
      croissance(rnd, chemins, bornes, N.x + Math.cos(a) * N.r * 0.5, N.y + Math.sin(a) * N.r * 0.5, a,
                 w0 * k * 0.95, N.P + N.r * 0.5, 0, Infinity, [0.005, 0.007]);
    });

    // Le hile (creux du haricot) de chaque ganglion regarde son vaisseau efférent
    const noeuds = [N1, N2, N3, N4];
    noeuds.forEach(N => { N.ang = Math.atan2(N.cible.y - N.y, N.cible.x - N.x); });

    // Arrière-plan : quelques longs vaisseaux hors mise au point, qui donnent la profondeur
    const rndF = aleaSeed(4242), fond = [];
    const bornesF = { x0: -260, x1: W + 260, y0: -260, y1: H + 260 };
    for(let i = 0; i < 5; i++){
      const bord = i % 4, u = 0.1 + 0.8 * rndF();
      const [x, y, ang] = bord === 0 ? [-200, u * vh, (rndF() - 0.5) * 0.9]
                        : bord === 1 ? [vw + 200, u * vh, Math.PI + (rndF() - 0.5) * 0.9]
                        : bord === 2 ? [u * vw, vh + 200, -Math.PI / 2 + (rndF() - 0.5) * 0.9]
                        :              [u * vw, -200, Math.PI / 2 + (rndF() - 0.5) * 0.9];
      croissance(rndF, fond, bornesF, x, y, ang, w0 * (1.1 + 0.8 * rndF()), 3000 + rndF() * 2000, 0, 2600, [0.002]);
    }

    return { principal: empaqueter(chemins, 0), fond: empaqueter(fond, 50), noeuds };
  }

  function tampon(){
    const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    [['aPos', 2, 0], ['aNor', 2, 2], ['aSide', 1, 4], ['aP', 1, 5], ['aW', 1, 6], ['aSeed', 1, 7], ['aTip', 1, 8]].forEach(([nom, taille, off]) => {
      const loc = gl.getAttribLocation(pTube.prog, nom);
      if(loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, taille, gl.FLOAT, false, 36, off * 4);
    });
    gl.bindVertexArray(null);
    return {
      vao, n: 0,
      remplir(g){
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, g.data, gl.STATIC_DRAW);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        this.n = g.idx.length;
      }
    };
  }
  const tPrincipal = tampon(), tFond = tampon();

  const vaoN = gl.createVertexArray();
  gl.bindVertexArray(vaoN);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const locC = gl.getAttribLocation(pNoeud.prog, 'aCorner');
  gl.enableVertexAttribArray(locC);
  gl.vertexAttribPointer(locC, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  let W = 0, H = 0, dpr = 1, keep = [0,0,0,0], clear = [0,0,0,0], reseau = null;

  function dimensionner(){
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const c = heroContent.getBoundingClientRect();
    keep = [c.left - r.left, c.top - r.top, c.right - r.left, c.bottom - r.top];
    if(marque && marque.isConnected){
      const n = marque.querySelector('.intro-nom').getBoundingClientRect(), mt = marque.querySelector('.intro-metier').getBoundingClientRect();
      clear = [Math.min(n.left, mt.left) - r.left + 20, n.top - r.top + 10, Math.max(n.right, mt.right) - r.left - 20, mt.bottom - r.top - 10];
    }
    reseau = construire(W, H, W, window.innerHeight);
    tPrincipal.remplir(reseau.principal);
    tFond.remplir(reseau.fond);
  }

  /* ---------- Rendu ------------------------------------------------------ */

  function uniformes(p, e){
    const u = p.u;
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uTime, e.temps);
    gl.uniform1f(u.uFront, e.front);
    gl.uniform1f(u.uTheme, e.theme);
    gl.uniform1f(u.uAlpha, e.alpha);
    gl.uniform1f(u.uFlou, e.flou);
    gl.uniform1f(u.uWmax, reseau.principal.wmax);
    gl.uniform3f(u.uOpen, reseau.noeuds[0].x, reseau.noeuds[0].y, e.ouverture);
    gl.uniform1f(u.uFondu, e.fondu);
    gl.uniform4f(u.uKeep, keep[0], keep[1], keep[2], keep[3]);
    gl.uniform1f(u.uKeepMix, e.keepMix);
    gl.uniform4f(u.uClear, clear[0], clear[1], clear[2], clear[3]);
    if(u.uZoom) gl.uniform3f(u.uZoom, reseau.noeuds[0].x, reseau.noeuds[0].y, e.zoom);
    if(u.uDrift) gl.uniform2f(u.uDrift, 0, 0);
  }

  function dessiner(e){
    if(!W || !H) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 1. Arrière-plan flou : sans profondeur, il dérive lentement sous le réseau net
    if(e.alphaFond > 0.001){
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(pTube.prog);
      uniformes(pTube, e);
      gl.uniform1f(pTube.u.uPass, 1);
      gl.uniform1f(pTube.u.uFlou, 1);
      gl.uniform1f(pTube.u.uFront, -1e5);
      gl.uniform1f(pTube.u.uAlpha, e.alphaFond);
      gl.uniform3f(pTube.u.uZoom, reseau.noeuds[0].x, reseau.noeuds[0].y, 1 + (e.zoom - 1) * 0.5);
      gl.uniform2f(pTube.u.uDrift, Math.sin(e.temps * 0.13) * 16, Math.cos(e.temps * 0.1) * 11);
      gl.bindVertexArray(tFond.vao);
      gl.drawElements(gl.TRIANGLES, tFond.n, gl.UNSIGNED_INT, 0);
    }

    // 2. Réseau principal : pré-passage de profondeur puis couleur
    gl.enable(gl.DEPTH_TEST);
    for(const pass of [0, 1]){
      gl.depthFunc(pass ? gl.LEQUAL : gl.LESS);
      gl.depthMask(pass === 0);
      gl.colorMask(pass === 1, pass === 1, pass === 1, pass === 1);

      gl.useProgram(pTube.prog);
      uniformes(pTube, e);
      gl.uniform1f(pTube.u.uPass, pass);
      gl.bindVertexArray(tPrincipal.vao);
      gl.drawElements(gl.TRIANGLES, tPrincipal.n, gl.UNSIGNED_INT, 0);

      gl.useProgram(pNoeud.prog);
      uniformes(pNoeud, e);
      gl.uniform1f(pNoeud.u.uPass, pass);
      gl.bindVertexArray(vaoN);
      const C = reseau.noeuds[0];
      reseau.noeuds.forEach(N => {
        gl.uniform2f(pNoeud.u.uCenter, (N.x - C.x) * e.zoom + C.x, (N.y - C.y) * e.zoom + C.y);
        gl.uniform1f(pNoeud.u.uR, N.r * e.zoom);
        gl.uniform1f(pNoeud.u.uAng, N.ang);
        gl.uniform1f(pNoeud.u.uPN, N.P);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    }
    gl.bindVertexArray(null);
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
  }

  /* ---------- Chronologie ----------------------------------------------- */

  // Secondes. Le rideau dure 3,1 s ; un clic, une touche ou la molette l'accélèrent.
  const T = {
    apparition: 1.1,                          // le réseau émerge du noir…
    nettete0: 0.1, nettete1: 1.3,             // …en sortant du flou
    remplissage0: 0.3, remplissage1: 2.05,    // la lymphe monte vers les ganglions
    nom: 0.45, nomFin: 1.9,
    ouverture0: 1.85, ouverture1: 3.1         // la lumière s'ouvre depuis le ganglion
  };
  const ALPHA_POSE = 0.45;     // réseau en filigrane derrière le texte
  const FLUX_POSE = 0.6;       // circulation ralentie une fois posé
  const borne = x => Math.min(Math.max(x, 0), 1);
  const lisse = x => { x = borne(x); return x * x * (3 - 2 * x); };
  const sinus = x => 0.5 - 0.5 * Math.cos(Math.PI * borne(x));
  const sortieDouce = x => 1 - Math.pow(1 - borne(x), 3);

  let t = avecRideau ? 0 : T.ouverture1, temps = 0, vitesse = 1;
  let pageLiberee = !avecRideau, pose = !avecRideau, marqueMontree = false, marqueCachee = false;

  function accelerer(){ if(!pose) vitesse = 3; }
  if(avecRideau){
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, accelerer, { passive: true, once: true }));
  }

  function etat(){
    const diag = Math.hypot(W, window.innerHeight);
    const fondu = diag * 0.55;
    if(!avecRideau || pose){
      return { temps, front: -1e5, theme: 1, ouverture: 1e5, fondu, keepMix: 1, alpha: ALPHA_POSE,
               alphaFond: 0, flou: 0, zoom: 1, po: 1 };
    }
    const apparition = lisse(t / T.apparition);
    const pr = sinus((t - T.remplissage0) / (T.remplissage1 - T.remplissage0));
    const po = sinus((t - T.ouverture0) / (T.ouverture1 - T.ouverture0));
    const P = reseau.principal.Pmax;
    return {
      temps,
      front: P + 140 - pr * (P + 340),
      theme: 0,
      ouverture: po * (diag + fondu + 200),
      fondu,
      keepMix: po,
      alpha: apparition * (1 - po * (1 - ALPHA_POSE)),
      alphaFond: apparition * 0.28 * (1 - po),
      flou: 1 - lisse((t - T.nettete0) / (T.nettete1 - T.nettete0)),
      zoom: 1 + 0.07 * (1 - sortieDouce(t / T.ouverture1)),
      po
    };
  }

  let dernier = performance.now(), visible = true, enBoucle = false;

  function image(maintenant){
    const dt = Math.min((maintenant - dernier) / 1000, 0.05);
    dernier = maintenant;
    if(!pose) t += dt * vitesse;
    let e = etat();
    temps += dt * (pose ? FLUX_POSE : 1 - e.po * (1 - FLUX_POSE));

    if(avecRideau && !pose){
      if(!marqueMontree && t > T.nom){ marqueMontree = true; marque.classList.add('on'); }
      if(!marqueCachee && t > T.nomFin){ marqueCachee = true; marque.classList.add('off'); }
      if(!pageLiberee && t >= T.ouverture0){
        pageLiberee = true;
        html.classList.remove('intro-on');   // les révélations du hero démarrent pendant l'ouverture
      }
      if(t >= T.ouverture0){
        // Même fondu que dans le shader : la lumière et le réseau clair avancent ensemble
        const N = reseau.noeuds[0], R = e.ouverture;
        const masque = `radial-gradient(circle at ${N.x}px ${N.y}px, transparent ${Math.max(R - e.fondu, 0)}px, #000 ${R}px)`;
        rideau.style.webkitMaskImage = masque; rideau.style.maskImage = masque;
        rideau.style.opacity = 1 - lisse((e.po - 0.4) / 0.6);
      }
      if(t >= T.ouverture1){
        pose = true;
        rideau.remove(); marque.remove();
        canvas.classList.remove('au-dessus'); html.classList.remove('intro-verrou');
        if('scrollRestoration' in history) history.scrollRestoration = 'auto';
        e = etat();
      }
    }

    dessiner(e);
    if(visible) requestAnimationFrame(image); else enBoucle = false;
  }

  function lancer(){
    visible = true;
    if(enBoucle) return;
    enBoucle = true;
    dernier = performance.now();
    requestAnimationFrame(image);
  }

  dimensionner();
  if(avecRideau) canvas.classList.add('visible');
  else requestAnimationFrame(() => canvas.classList.add('visible'));
  lancer();

  // Pause dès que le hero sort de l'écran ou que l'onglet est caché (une fois posé)
  new IntersectionObserver(([en]) => {
    if(en.isIntersecting) lancer(); else if(pose) visible = false;
  }).observe(hero);
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ if(pose) visible = false; } else lancer();
  });

  // La géométrie suit la taille réelle du hero : elle peut être nulle au chargement
  // (onglet ouvert en arrière-plan) ou changer quand les polices arrivent.
  let minuteur;
  new ResizeObserver(() => {
    const r = hero.getBoundingClientRect();
    if(Math.round(r.width) === W && Math.round(r.height) === H) return;
    clearTimeout(minuteur);
    if(!W || !H) dimensionner();
    else minuteur = setTimeout(dimensionner, 150);
  }).observe(hero);
  // Fenêtre redimensionnée pendant le rideau : on l'écourte plutôt que de recomposer
  window.addEventListener('resize', () => { if(!pose) vitesse = 6; });
})();
