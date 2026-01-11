const navToggle = document.querySelector('.menu-toggle');
const navMenu = document.querySelector('.site-nav');

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

const linkCards = document.querySelectorAll('.link-card');
linkCards.forEach((card) => {
  card.addEventListener('focus', () => {
    card.classList.add('is-focused');
  });
  card.addEventListener('blur', () => {
    card.classList.remove('is-focused');
  });
});

const buttons = document.querySelectorAll('.button');
buttons.forEach((button) => {
  button.addEventListener('mouseenter', () => {
    button.classList.add('is-hovered');
  });
  button.addEventListener('mouseleave', () => {
    button.classList.remove('is-hovered');
  });
});

const currentYear = new Date().getFullYear();
const footers = document.querySelectorAll('.site-footer');
footers.forEach((footer) => {
  const yearNode = document.createElement('p');
  yearNode.className = 'note';
  yearNode.textContent = `© ${currentYear} NO SIGNAL RECORDS — all rights reserved.`;
  footer.appendChild(yearNode);
});
