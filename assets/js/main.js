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
  } else if (currentPath.includes('/Code/') || currentPath.endsWith('/Code')) {
    return 'Code';
  } else if (currentPath.includes('/Talks/') || currentPath.endsWith('/Talks')) {
    return 'Talks';
  } else if (currentPath.includes('/Teaching/') || currentPath.endsWith('/Teaching')) {
    return 'Teaching';
  } else {
    return 'Home';
  }
}

// NEW FUNCTION - Replace loadSidebar with this
function createSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');

  // Detect if we're in a subfolder by checking the current path
  const currentPath = window.location.pathname;
  const isInSubfolder = currentPath.includes('/Research/') || currentPath.includes('/Code/') || currentPath.includes('/Talks/') || currentPath.includes('/Teaching/');

  // Adjust paths based on folder location
  const homeLink = isInSubfolder ? '../index.html' : 'index.html';
  const researchLink = isInSubfolder ? (currentPath.includes('/Research/') ? 'index.html' : '../Research/index.html') : 'Research/index.html';
  const codeLink = isInSubfolder ? (currentPath.includes('/Code/') ? 'index.html' : '../Code/index.html') : 'Code/index.html';
  const talksLink = isInSubfolder ? (currentPath.includes('/Talks/') ? 'index.html' : '../Talks/index.html') : 'Talks/index.html';
  const teachingLink = isInSubfolder ? (currentPath.includes('/Teaching/') ? 'index.html' : '../Teaching/index.html') : 'Teaching/index.html';

  const currentPageName = getCurrentPageName();

  const sidebarHTML = `
    <aside class="sidebar">
      <img class="profile-img" src="https://web.maths.unsw.edu.au/~cbagshaw/pic.PNG" alt="Picture of Christian Bagshaw">
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
        <button class="nav-toggle" onclick="toggleNav()" id="navToggle">
          ${currentPageName}
          <div class="hamburger">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        <div class="nav-links" id="navLinks">
          <a href="${homeLink}" class="nav-link">Home</a>
          <a href="${researchLink}" class="nav-link">Research</a>
          <a href="${codeLink}" class="nav-link">Code</a>
          <a href="${talksLink}" class="nav-link">Talks</a>
        </div>
      </nav>
    </aside>

    <!-- Fullscreen navigation overlay -->
    <div class="nav-overlay" id="navOverlay">
      <button class="nav-close" onclick="closeNav()" aria-label="Close navigation">×</button>
      <div class="nav-links">
        <a href="${homeLink}" class="nav-link" onclick="closeNav()">Home</a>
        <a href="${researchLink}" class="nav-link" onclick="closeNav()">Research</a>
        <a href="${codeLink}" class="nav-link" onclick="closeNav()">Code</a>
        <a href="${talksLink}" class="nav-link" onclick="closeNav()">Talks</a>
      </div>
    </div>
  `;

  sidebarContainer.innerHTML = sidebarHTML;
  setActiveNavLink();
}

// Set active navigation link based on current page
function setActiveNavLink() {
  const currentPage = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    
    if (currentPage.includes(href) || (currentPage === '/' && href === 'index.html')) {
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
