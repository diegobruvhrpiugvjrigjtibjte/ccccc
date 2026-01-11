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

const cookieBanner = document.querySelector('[data-cookie-banner]');
const cookieModal = document.querySelector('[data-cookie-modal]');
const cookieAccept = document.querySelector('[data-cookie-accept]');
const cookieDetails = document.querySelector('[data-cookie-details]');
const cookieClose = document.querySelector('[data-cookie-close]');
const cookieKey = 'nsr-cookie-consent';

const showCookieBanner = () => {
  if (cookieBanner) {
    cookieBanner.hidden = false;
  }
};

const hideCookieBanner = () => {
  if (cookieBanner) {
    cookieBanner.hidden = true;
  }
};

const openCookieModal = () => {
  if (cookieModal) {
    cookieModal.hidden = false;
  }
};

const closeCookieModal = () => {
  if (cookieModal) {
    cookieModal.hidden = true;
  }
};

if (!localStorage.getItem(cookieKey)) {
  showCookieBanner();
}

cookieAccept?.addEventListener('click', () => {
  localStorage.setItem(cookieKey, 'all');
  hideCookieBanner();
  closeCookieModal();
});

cookieDetails?.addEventListener('click', () => {
  openCookieModal();
});

cookieClose?.addEventListener('click', () => {
  closeCookieModal();
});

cookieModal?.addEventListener('click', (event) => {
  if (event.target === cookieModal) {
    closeCookieModal();
  }
});
