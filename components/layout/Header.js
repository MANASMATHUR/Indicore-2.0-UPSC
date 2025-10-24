'use client';

import { useState } from 'react';
import Button from '../ui/Button';
import ThemeDropdown from '../ThemeDropdown';

const Header = ({ 
  user, 
  onMenuClick, 
  onSettingsClick, 
  onLogout,
  onExamUpload,
  onEssayEnhancement,
  onVocabularyBuilder,
  onMockEvaluation,
  onDownloadPDF,
  currentTheme,
  onThemeChange
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const headerActions = [
    {
      id: 'exam-upload',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: onExamUpload,
      title: 'Upload Exam Paper for Evaluation'
    },
    {
      id: 'essay-enhancement',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: onEssayEnhancement,
      title: 'Essay & Answer Writing Enhancement'
    },
    {
      id: 'vocabulary-builder',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      onClick: onVocabularyBuilder,
      title: 'Bilingual Vocabulary Builder'
    },
    {
      id: 'mock-evaluation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      onClick: onMockEvaluation,
      title: 'Regional Language Mock Evaluation'
    },
    {
      id: 'download-pdf',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: onDownloadPDF,
      title: 'Download chat as PDF'
    },
  ];

  return (
    <header className="bg-gradient-to-r from-red-50/95 via-orange-50/95 to-red-100/95 dark:bg-gradient-to-r dark:from-slate-900/95 dark:via-slate-800/95 dark:to-slate-900/95 border-b border-red-200/50 dark:border-slate-600/50 p-2 sm:p-4 text-center relative shadow-lg dark:shadow-xl backdrop-blur-md">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onMenuClick();
        }}
        className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-red-500 text-white p-2 sm:p-3 rounded-lg hover:bg-red-600 cursor-pointer z-50 transition-all duration-200"
        style={{ 
          fontSize: '12px',
          fontWeight: 'bold'
        }}
        aria-label="Toggle sidebar"
      >
        <span className="hidden sm:inline">☰ MENU</span>
        <span className="sm:hidden">☰</span>
      </button>

      <div className="animate-fade-in">
        <h1 className="text-lg sm:text-xl font-semibold text-red-900 dark:text-slate-100 bg-gradient-to-r from-red-600 to-red-800 dark:from-slate-300 dark:to-slate-100 bg-clip-text text-transparent">🎓 Indicore</h1>
        <p className="text-xs sm:text-sm text-red-700 dark:text-slate-300 font-medium">PCS • UPSC • SSC Exam Prep AI</p>
      </div>

      <div className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 flex gap-1 sm:gap-2">
        {/* Show only essential actions on mobile */}
        <div className="hidden sm:flex gap-1 sm:gap-2">
          {headerActions.map((action) => (
            <Button
              key={action.id}
              variant="ghost"
              size="icon"
              onClick={action.onClick}
              title={action.title}
              className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
            >
              {action.icon}
            </Button>
          ))}
        </div>

        <ThemeDropdown currentTheme={currentTheme} onThemeChange={onThemeChange} />
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          title="Settings"
          className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-200 dark:hover:bg-red-800"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Button>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
            aria-label="User menu"
          >
            <img 
              src={user.avatar || '/static/default-avatar.jpg'} 
              alt={user.name} 
              className="w-6 h-6 rounded-full" 
            />
          </Button>

          {showUserMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowUserMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-red-200 dark:border-slate-600 z-20">
                <div className="p-3 border-b border-red-200 dark:border-slate-600">
                  <p className="font-medium text-red-800 dark:text-slate-100">{user.name}</p>
                  <p className="text-sm text-red-600 dark:text-slate-300">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={onLogout}
                  className="w-full justify-start text-left px-3 py-2 text-sm text-red-700 dark:text-slate-200 hover:bg-red-100 dark:hover:bg-slate-700"
                >
                  Sign Out
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
