import { useState } from 'react';
import { useSession } from 'next-auth/react';
import PreferencesDashboard from '@/components/settings/PreferencesDashboard';
import MemoryManager from '@/components/settings/MemoryManager';

/**
 * Settings page with tabs for Preferences and Memory
 * Similar to ChatGPT's settings layout
 */
export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('memory');

  // Show loading during session check
  if (status === 'loading') {
    return (
      <div className="settings-page">
        <div className="login-prompt">
          <div className="spinner"></div>
          <p>Loading...</p>
          <style jsx>{`
            .settings-page {
              min-height: 100vh;
              background: #f5f5f5;
              padding: 2rem;
            }
            .login-prompt {
              max-width: 500px;
              margin: 4rem auto;
              text-align: center;
              background: white;
              padding: 3rem;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 4px solid #f3f3f3;
              border-top: 4px solid #007bff;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 1rem;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="settings-page">
        <div className="login-prompt">
          <h2>Sign in to access settings</h2>
          <p>Please sign in to customize your experience</p>
        </div>
        <style jsx>{`
          .settings-page {
            min-height: 100vh;
            background: #f5f5f5;
            padding: 2rem;
          }
          .login-prompt {
            max-width: 500px;
            margin: 4rem auto;
            text-align: center;
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-sidebar">
          <h1>⚙️ Settings</h1>
          <nav className="settings-nav">
            <button
              className={`nav-item ${activeTab === 'memory' ? 'active' : ''}`}
              onClick={() => setActiveTab('memory')}
            >
              <span className="nav-icon">🧠</span>
              <div>
                <div className="nav-title">Memory</div>
                <div className="nav-subtitle">Manage what the AI remembers</div>
              </div>
            </button>
            <button
              className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <span className="nav-icon">🎨</span>
              <div>
                <div className="nav-title">Preferences</div>
                <div className="nav-subtitle">UI, study schedule, notifications</div>
              </div>
            </button>
          </nav>
        </div>

        <div className="settings-content">
          {activeTab === 'memory' && <MemoryManager />}
          {activeTab === 'preferences' && <PreferencesDashboard />}
        </div>
      </div>

      <style jsx>{`
        .settings-page {
          min-height: 100vh;
          background: #f5f5f5;
          padding: 2rem;
        }

        .settings-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2rem;
          align-items: start;
        }

        .settings-sidebar {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          position: sticky;
          top: 2rem;
        }

        .settings-sidebar h1 {
          font-size: 1.75rem;
          margin: 0 0 1.5rem 0;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .settings-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }

        .nav-item:hover {
          background: #f8f9fa;
        }

        .nav-item.active {
          background: #e7f3ff;
          border-left: 3px solid #007bff;
        }

        .nav-icon {
          font-size: 1.5rem;
        }

        .nav-title {
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }

        .nav-subtitle {
          font-size: 0.85rem;
          color: #666;
        }

        .settings-content {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          min-height: 500px;
        }

        @media (max-width: 768px) {
          .settings-container {
            grid-template-columns: 1fr;
          }

          .settings-sidebar {
            position: static;
          }

          .settings-nav {
            flex-direction: row;
            overflow-x: auto;
          }

          .nav-item {
            flex-direction: column;
            text-align: center;
            min-width: 140px;
          }

          .nav-subtitle {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

// Disable static generation - this page needs client-side session
export async function getServerSideProps() {
  return {
    props: {}
  };
}
