// Intercepte les clics pour une navigation fluide instantanée
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href.startsWith(window.location.origin) && !link.getAttribute('target')) {
    e.preventDefault();
    if (!document.startViewTransition) {
      window.location = link.href;
      return;
    }
    document.startViewTransition(() => {
      window.location = link.href;
    });
  }
});
