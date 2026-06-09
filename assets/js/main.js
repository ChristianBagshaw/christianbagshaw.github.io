function toggleNav() {
  const navToggle = document.getElementById('navToggle');
  const navOverlay = document.getElementById('navOverlay');
  
  navToggle.classList.toggle('active');
  navOverlay.classList.toggle('show');
  
  // Prevent scrolling when overlay is open
  if (navOverlay.classList.contains('show')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

function closeNav() {
  const navToggle = document.getElementById('navToggle');
  const navOverlay = document.getElementById('navOverlay');
  
  navToggle.classList.remove('active');
  navOverlay.classList.remove('show');
  document.body.style.overflow = '';
}

// Toast notification function
function showToast(message, type = 'default') {
  // Remove any existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }, 3000);
}

function getCurrentPageName() {
  const currentPath = window.location.pathname;
  
  if (currentPath.includes('/Research/') || currentPath.endsWith('/Research')) {
    return 'Research';
  } else if (currentPath.includes('/Projects/') || currentPath.endsWith('/Projects')) {
    return 'Projects';
  } else if (currentPath.includes('/Talks/') || currentPath.endsWith('/Talks')) {
    return 'Talks';
  } else if (currentPath.includes('/Teaching/') || currentPath.endsWith('/Teaching')) {
    return 'Teaching';
  } else if (currentPath.includes('/fantasy/') || currentPath.endsWith('/fantasy')) {
    return 'Fantasy Football Projections';
  } else {
    return 'Home';
  }
}

// NEW FUNCTION - Replace loadSidebar with this
function createSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');

  // Detect if we're in a subfolder by checking the current path
  const currentPath = window.location.pathname;
  const isInSubfolder = currentPath.includes('/Research/') || currentPath.includes('/Projects/') || currentPath.includes('/Talks/') || currentPath.includes('/Teaching/') || currentPath.includes('/fantasy/');

  // Adjust paths based on folder location
  const homeLink = isInSubfolder ? '../index.html' : 'index.html';
  const researchLink = isInSubfolder ? (currentPath.includes('/Research/') ? 'index.html' : '../Research/index.html') : 'Research/index.html';
  const projectsLink = isInSubfolder ? (currentPath.includes('/Projects/') ? 'index.html' : '../Projects/index.html') : 'Projects/index.html';
  const talksLink = isInSubfolder ? (currentPath.includes('/Talks/') ? 'index.html' : '../Talks/index.html') : 'Talks/index.html';
  const teachingLink = isInSubfolder ? (currentPath.includes('/Teaching/') ? 'index.html' : '../Teaching/index.html') : 'Teaching/index.html';
  const fantasyLink = isInSubfolder ? (currentPath.includes('/fantasy/') ? 'index.html' : '../fantasy/index.html') : 'fantasy/index.html';
  const profileImage = isInSubfolder ? '../assets/img/profile.png' : 'assets/img/profile.png';

  const sidebarHTML = `
    <aside class="sidebar">
      <img class="profile-img" src="${profileImage}" alt="Picture of Christian Bagshaw">
      <div class="profile-info">
        <h1 class="name">Christian Bagshaw</h1>
        <p class="title">PhD in Mathematics</p>
        <p class="title">Data Scientist at Audinate</p>
      </div>

      <div class="external-icons">
        <a href="#" class="contact-link" id="copyEmail" aria-label="Copy email">
          <i class="far fa-envelope"></i>
        </a>
        <a
          href="https://www.linkedin.com/in/christian-bagshaw-phd-59b1a3168/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
        >
          <i class="fab fa-linkedin"></i>
        </a>
        <a
          href="https://scholar.google.com/citations?user=QeFwjvwAAAAJ&hl=en&oi=ao"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Google Scholar"
        >
          <i class="fas fa-graduation-cap"></i>
        </a>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-links" id="navLinks">
          <a href="${homeLink}" class="nav-link">Home</a>
          <a href="${researchLink}" class="nav-link">Research</a>
          <a href="${projectsLink}" class="nav-link">Projects</a>
          <a href="${talksLink}" class="nav-link">Talks</a>
          <a href="${fantasyLink}" class="nav-link" style="grid-column: 1 / -1;">Fantasy Football Projections</a>
        </div>
      </nav>
    </aside>
  `;

  sidebarContainer.innerHTML = sidebarHTML;
  setActiveNavLink();
}

// Set active navigation link based on current page
function setActiveNavLink() {
  const currentPageName = getCurrentPageName();
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.classList.remove('active');

    if (link.textContent.trim() === currentPageName) {
      link.classList.add('active');
    }
  });
}

// Initialize the dropdown as closed on page load
window.addEventListener('load', function() {
  const navOverlay = document.getElementById('navOverlay');
  const navToggle = document.getElementById('navToggle');
  
  if (navOverlay && navToggle) {
    navOverlay.classList.remove('show');
    navToggle.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// Close navigation when clicking outside or pressing escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeNav();
  }
});

// Prevent closing when clicking inside the nav content
document.addEventListener('click', function(e) {
  const navOverlay = document.getElementById('navOverlay');
  const navToggle = document.getElementById('navToggle');
  
  if (navOverlay && navOverlay.classList.contains('show')) {
    // If clicking on the overlay background (not the nav content)
    if (e.target === navOverlay) {
      closeNav();
    }
  }
});

// Email copy functionality
document.addEventListener("DOMContentLoaded", () => {
  createSidebar();
  
  // Wait a moment for the sidebar to be created, then initialize email functionality
  setTimeout(() => {
    const email = "christiangbagshaw@gmail.com";
    const copyLink = document.getElementById("copyEmail");

    if (copyLink) {
      copyLink.addEventListener("click", function(e) {
        e.preventDefault();
        
        navigator.clipboard.writeText(email).then(() => {
          // Show toast notification
          showToast("Copied!", "simple");
          
          // Optional: Brief color change on the email icon
          copyLink.classList.add('copied');
          setTimeout(() => {
            copyLink.classList.remove('copied');
          }, 500);
          
        }).catch(() => {
          // Fallback for older browsers
          showToast("Please copy manually: " + email);
        });
      });
    }
  }, 100);
});
