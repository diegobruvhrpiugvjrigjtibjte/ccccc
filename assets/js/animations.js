const initReveal = () => {
  const targets = Array.from(document.querySelectorAll("main section"));
  if (!targets.length || !("IntersectionObserver" in window)) return;

  targets.forEach((section) => section.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  targets.forEach((section) => observer.observe(section));
};

document.addEventListener("DOMContentLoaded", () => {
  initReveal();
});
