const initStickyHeader = () => {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 20);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
};

document.addEventListener("DOMContentLoaded", () => {
  initStickyHeader();
});
