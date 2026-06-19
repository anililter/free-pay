// Admin Content Loader - Tüm sayfalara eklenecek
(function() {
    'use strict';
    
    // Get current page file path
    function getCurrentPagePath() {
        const path = window.location.pathname;
        if (path === '/' || path.endsWith('/')) {
            return 'index';
        }
        return path.split('/').pop() || 'index';
    }
    
    // Load saved content data
    function loadAdminContent() {
        try {
            const savedData = localStorage.getItem('adminContentData');
            if (!savedData) return;
            
            const contentData = JSON.parse(savedData);
            const currentPage = getCurrentPagePath();
            const pageData = contentData.pages[currentPage];
            
            if (!pageData) return;
            
            // Apply text changes
            if (pageData.texts) {
                pageData.texts.forEach(text => {
                    if (text.updated && text.selector) {
                        try {
                            // Try multiple selector strategies
                            let element = null;
                            
                            // Try direct selector
                            try {
                                element = document.querySelector(text.selector);
                            } catch (e) {
                                // If selector fails, try by ID
                                if (text.id && text.id.startsWith('text-')) {
                                    // Try to find by content match
                                    const allElements = document.querySelectorAll(text.tag || '*');
                                    allElements.forEach(el => {
                                        if (el.textContent.trim() === text.text || 
                                            (text.originalText && el.textContent.trim() === text.originalText)) {
                                            element = el;
                                        }
                                    });
                                }
                            }
                            
                            if (element) {
                                // Preserve original text if not already saved
                                if (!text.originalText) {
                                    text.originalText = element.textContent.trim();
                                }
                                element.textContent = text.text;
                            }
                        } catch (error) {
                            console.warn('Could not update text:', text.selector, error);
                        }
                    }
                });
            }
            
            // Apply logo changes
            if (pageData.logos) {
                pageData.logos.forEach(logo => {
                    if (logo.updated && logo.src) {
                        try {
                            let element = null;
                            
                            if (logo.selector) {
                                element = document.querySelector(logo.selector);
                            } else {
                                // Try to find logo by common selectors
                                element = document.querySelector('.logo img') || 
                                         document.querySelector('.logo-img') ||
                                         document.querySelector('img[src*="logo"]');
                            }
                            
                            if (element) {
                                element.src = logo.src;
                                if (logo.alt) {
                                    element.alt = logo.alt;
                                }
                            }
                        } catch (error) {
                            console.warn('Could not update logo:', error);
                        }
                    }
                });
            }
            
            // Apply global logo changes
            Object.values(contentData.logos || {}).forEach(logo => {
                if (logo.updated && logo.src) {
                    try {
                        if (logo.type === 'main') {
                            const elements = document.querySelectorAll('.logo img, .logo-img');
                            elements.forEach(el => {
                                el.src = logo.src;
                            });
                        } else if (logo.type === 'footer') {
                            const elements = document.querySelectorAll('.footer-logo-img, footer .logo img');
                            elements.forEach(el => {
                                el.src = logo.src;
                            });
                        }
                    } catch (error) {
                        console.warn('Could not update global logo:', error);
                    }
                }
            });
            
            // Apply icon changes
            if (pageData.icons) {
                pageData.icons.forEach(icon => {
                    if (icon.updated && icon.html && icon.selector) {
                        try {
                            const element = document.querySelector(icon.selector);
                            if (element) {
                                element.outerHTML = icon.html;
                            }
                        } catch (error) {
                            console.warn('Could not update icon:', error);
                        }
                    }
                });
            }
            
            // Apply image changes
            if (pageData.images) {
                pageData.images.forEach(image => {
                    if (image.updated && image.src && image.selector) {
                        try {
                            const element = document.querySelector(image.selector);
                            if (element) {
                                element.src = image.src;
                                if (image.alt) {
                                    element.alt = image.alt;
                                }
                            }
                        } catch (error) {
                            console.warn('Could not update image:', error);
                        }
                    }
                });
            }
            
        } catch (error) {
            console.error('Error loading admin content:', error);
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAdminContent);
    } else {
        loadAdminContent();
    }
    
    // Also run after delays to catch dynamically loaded content
    setTimeout(loadAdminContent, 500);
    setTimeout(loadAdminContent, 1500);
})();
