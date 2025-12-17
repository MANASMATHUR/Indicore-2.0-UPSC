'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import Logo from '@/components/Logo';
import ThemeDropdown from '../ThemeDropdown';
import ContactUsModal from '@/components/ContactUsModal';

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
  onSearchClick,
  onGenerateFlashcards, // New prop
  currentTheme,
  onThemeChange
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showExamSubmenu, setShowExamSubmenu] = useState(false);
  const [showWritingSubmenu, setShowWritingSubmenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const toolsMenuItems = [
    {
      id: 'exam-tools',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: () => {
        setShowExamSubmenu(!showExamSubmenu);
      },
      title: 'Exam Tools',
      description: 'Paper evaluation & mock tests',
      hasSubmenu: true
    },
    {
      id: 'writing-tools',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: () => {
        setShowWritingSubmenu(!showWritingSubmenu);
      },
      title: 'Writing Tools',
      description: 'Essay enhancement & vocabulary',
      hasSubmenu: true
    },
    {
      id: 'generate-flashcards',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      onClick: onGenerateFlashcards,
      title: 'Generate Flashcards',
      description: 'Create cards from chats'
    },
    {
      id: 'download-pdf',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: onDownloadPDF,
      title: 'Download PDF',
      description: 'Save chat as PDF'
    },
  ];

  const examSubmenuItems = [
    {
      id: 'exam-upload',
      onClick: onExamUpload,
      title: 'Paper Evaluation',
      description: 'Upload exam papers for evaluation'
    },
    {
      id: 'mock-evaluation',
      title: 'Mock Tests',
      href: '/mock-tests',
      icon: '📝',
      description: 'Practice with AI-generated tests'
    },
    {
      title: 'For You',
      href: '/recommendations',
      icon: '✨',
      description: 'Personalized recommendations'
    },
  ];

  const writingSubmenuItems = [
    {
      id: 'essay-enhancement',
      onClick: onEssayEnhancement,
      title: 'Essay Enhancement',
      description: 'Improve writing skills'
    },
    {
      id: 'vocabulary-builder',
      onClick: onVocabularyBuilder,
      title: 'Vocabulary Builder',
      description: 'Learn bilingual vocabulary'
    }
  ];

  return (
    <header className="sticky top-0 z-[80] bg-gradient-to-r from-red-50/95 via-orange-50/95 to-red-100/95 dark:bg-gradient-to-r dark:from-slate-900/95 dark:via-slate-800/95 dark:to-slate-900/95 border-b border-red-200/50 dark:border-slate-600/50 p-3 sm:p-4 text-center shadow-lg dark:shadow-xl backdrop-blur-md">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onMenuClick();
        }}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 transform bg-red-500 text-white px-3 py-2 sm:px-4 sm:py-3 rounded-lg hover:bg-red-600 active:bg-red-700 cursor-pointer z-50 transition-colors duration-200 select-none touch-manipulation text-[12px] font-semibold"
        aria-label="Toggle sidebar"
      >
        <span className="hidden sm:inline">Menu</span>
        <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex flex-col items-center">
        <Logo variant="light" showText={true} size="sm" />
      </div>

      <div className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 flex gap-1 sm:gap-2">
        {/* Contact Us Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowContactModal(true)}
          title="Contact Us"
          className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </Button>

        {/* Search Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (onSearchClick) {
              onSearchClick();
            }
          }}
          title="Search in chat (Ctrl+F or Cmd+F)"
          className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </Button>

        {/* Consolidated Tools Menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            title="Tools & Features"
            aria-haspopup="true"
            aria-expanded={showToolsMenu}
            className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </Button>

          {showToolsMenu && (
            <>
              <div
                className="fixed inset-0 z-[90]"
                onClick={() => setShowToolsMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-red-200 dark:border-slate-600 z-[100] max-h-[calc(100vh-120px)] overflow-y-auto">
                <div className="p-3 border-b border-red-200 dark:border-slate-600">
                  <h3 className="font-semibold text-red-800 dark:text-slate-100">Tools & Features</h3>
                  <p className="text-xs text-red-600 dark:text-slate-300">Access all exam preparation tools</p>
                </div>
                <div className="p-2">
                  {toolsMenuItems.map((item) => (
                    <div key={item.id} className="relative">
                      <button
                        onClick={() => {
                          if (item.hasSubmenu) {
                            item.onClick();
                          } else {
                            item.onClick();
                            setShowToolsMenu(false);
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-3 group"
                        aria-haspopup={item.hasSubmenu ? "true" : undefined}
                        aria-expanded={
                          item.hasSubmenu
                            ? item.id === 'exam-tools'
                              ? showExamSubmenu
                              : item.id === 'writing-tools'
                                ? showWritingSubmenu
                                : undefined
                            : undefined
                        }
                      >
                        <div className="text-red-600 dark:text-red-400 group-hover:text-red-800 dark:group-hover:text-red-200">
                          {item.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                        </div>
                        {item.hasSubmenu && (
                          <div className="text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </button>

                      {/* Exam Tools Submenu */}
                      {item.id === 'exam-tools' && showExamSubmenu && (
                        <div className="ml-4 mt-1 border-l-2 border-red-200 dark:border-red-700 pl-2">
                          {examSubmenuItems.map((subItem) => (
                            <button
                              key={subItem.id}
                              onClick={() => {
                                subItem.onClick();
                                setShowToolsMenu(false);
                                setShowExamSubmenu(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md flex items-center gap-2 group"
                            >
                              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                              <div>
                                <div className="font-medium">{subItem.title}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Writing Tools Submenu */}
                      {item.id === 'writing-tools' && showWritingSubmenu && (
                        <div className="ml-4 mt-1 border-l-2 border-red-200 dark:border-red-700 pl-2">
                          {writingSubmenuItems.map((subItem) => (
                            <button
                              key={subItem.id}
                              onClick={() => {
                                subItem.onClick();
                                setShowToolsMenu(false);
                                setShowWritingSubmenu(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md flex items-center gap-2 group"
                            >
                              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                              <div>
                                <div className="font-medium">{subItem.title}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Temporarily disabled dark mode - ThemeDropdown hidden */}
        {/* <ThemeDropdown currentTheme={currentTheme} onThemeChange={onThemeChange} /> */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowToolsMenu(false);
            onSettingsClick();
          }}
          title="Settings"
          className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-200 dark:hover:bg-red-800 z-50"
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
            aria-haspopup="true"
            aria-expanded={showUserMenu}
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
                className="fixed inset-0 z-[90]"
                onClick={() => setShowUserMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-red-200 dark:border-slate-600 z-[100]">
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

      {/* Contact Us Modal */}
      <ContactUsModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </header>
  );
};

export default Header;
