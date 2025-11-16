// user-loader.js

// Get necessary data from localStorage
const authToken = localStorage.getItem("authToken");
const userRole = localStorage.getItem("userRole"); 
const isLoggedIn = !!authToken;

// Determine the current page for checks
const currentPage = window.location.pathname.split("/").pop() || "index.html"; 

// Pages that should be inaccessible AFTER login
const loginPages = ["login.html", "register.html", "admin-login.html"];

// Pages that must be protected (requires a user to be logged in)
const studentProtectedPages = [
    // REMOVED 'index.html' from this list to make it accessible to everyone.
    "portal.html", 
    "profile.html", 
    "courses.html", 
    "other-courses.html", 
    "lessons.html",       
    "curriculum.html",    
    "feedback.html"       
];

// Admin-only pages
const adminPages = ["admin.html", "admin-portal.html", "manage-users.html"]; 


/**
 * 1. POST-LOGIN REDIRECTION (Block login pages if logged in)
 * If the user is logged in and tries to access a login-related page, send them to the main portal (index.html).
 */
if (isLoggedIn && loginPages.includes(currentPage)) {
    window.location.href = "index.html"; 
}

/**
 * 2. GENERAL PAGE PROTECTION (Block unauthenticated users)
 * If NOT logged in, redirect them to login.html if they try to access any protected page.
 */
if (!isLoggedIn) {
    // Combine all pages that require login (Student + Admin)
    const allProtectedPages = [...studentProtectedPages, ...adminPages];

    // Only redirect if the current page is protected AND is NOT a login page
    if (allProtectedPages.includes(currentPage) && !loginPages.includes(currentPage)) {
        window.location.href = "login.html";
    }
}

/**
 * 3. ROLE-BASED ACCESS CONTROL (Admin-only pages)
 * If the page is an admin page AND the user is not an admin, redirect them.
 */
if (adminPages.includes(currentPage) && userRole !== "admin") {
    // Redirect non-admins trying to access admin pages to a safe student area
    window.location.href = "portal.html"; 
}