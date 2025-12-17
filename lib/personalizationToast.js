/**
 * Personalization Toast Notifications
 * Shows users when personalization is happening
 */

export function showPersonalizationToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `personalization-toast personalization-toast-${type}`;
    toast.innerHTML = `
    <div class="personalization-toast-content">
      <span class="personalization-toast-icon">✨</span>
      <span class="personalization-toast-message">${message}</span>
    </div>
  `;

    // Add to DOM
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Toast notification styles
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
    .personalization-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 9999;
      max-width: 400px;
    }

    .personalization-toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    .personalization-toast-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .personalization-toast-icon {
      font-size: 20px;
    }

    .personalization-toast-message {
      font-size: 14px;
      font-weight: 500;
    }

    .personalization-toast-info {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .personalization-toast-success {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }

    .personalization-toast-warning {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    @media (max-width: 640px) {
      .personalization-toast {
        bottom: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }
    }
  `;
    document.head.appendChild(style);
}

export default {
    showPersonalizationToast
};
