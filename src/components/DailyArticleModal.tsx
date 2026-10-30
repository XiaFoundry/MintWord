import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XMarkIcon,
  SparklesIcon,
  ArrowPathIcon,
  BookOpenIcon,
  CheckCircleIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import { t } from '../lib/i18n';
import TagInput from './TagInput';
import Select from './Select';
import {
  createArticle,
  saveQuestions,
  generateDailyArticle,
  getSetting,
  getDailyArticlePrompt,
} from '../lib/api';
import { buildDailyArticlePrompt, inferDeckDifficulty } from '../lib/dailyArticlePrompt';
import type { ProviderConfig, Article } from '../types';

interface DailyArticleModalProps {
  open: boolean;
  onClose: () => void;
  initialWords?: string[];
  deckName?: string;
  deckLanguage?: string;
}

export default function DailyArticleModal({
  open,
  onClose,
  initialWords = [],
  deckName,
  deckLanguage = 'en',
}: DailyArticleModalProps) {
  if (!open) return null;

  return (
    <DailyArticleModalContent
      onClose={onClose}
      initialWords={initialWords}
      deckName={deckName}
      deckLanguage={deckLanguage}
    />
  );
}

interface ContentProps {
  onClose: () => void;
  initialWords: string[];
  deckName?: string;
  deckLanguage: string;
}

function DailyArticleModalContent({ onClose, initialWords, deckName, deckLanguage }: ContentProps) {
  const navigate = useNavigate();

  const [words, setWords] = useState<string[]>(() =>
    initialWords.length > 0 ? [...new Set(initialWords.map((w) => w.trim()).filter(Boolean))] : []
  );
  const [includeQuestions, setIncludeQuestions] = useState(true);

  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [selectedProviderIndex, setSelectedProviderIndex] = useState('0');

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedArticle, setSavedArticle] = useState<Article | null>(null);

  const difficultyInfo = inferDeckDifficulty(deckName, deckLanguage);
  const languageLabel = deckLanguage === 'ja' ? '日本語 (日语)' : 'English (英语)';
  const langText = deckLanguage === 'ja' ? '日文' : '英文';

  useEffect(() => {
    (async () => {
      // Load AI providers
      try {
        const json = await getSetting('ai_provider_config_list');
        if (json) {
          const list: ProviderConfig[] = JSON.parse(json);
          setProviders(list);
          if (list.length > 0) {
            setSelectedProviderIndex('0');
          }
        }
      } catch {
        setProviders([]);
      }
    })();
  }, []);

  const currentProvider = providers[Number(selectedProviderIndex)] || providers[0];

  const providerOptions = providers.map((p, idx) => ({
    value: String(idx),
    label: `${p.modelName || p.modelId} (${p.providerId})`,
  }));

  async function handleGenerate() {
    if (words.length === 0) {
      setError(t('daily_article.empty_words_warn'));
      return;
    }
    if (!currentProvider) {
      setError(t('daily_article.no_model_hint'));
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const customPromptTemplate = await getDailyArticlePrompt();
      const prompt = buildDailyArticlePrompt(
        langText,
        difficultyInfo.description,
        includeQuestions,
        customPromptTemplate
      );

      const result = await generateDailyArticle(words, langText, currentProvider, prompt);

      // Save generated article to library
      const created = await createArticle(result.title, result.content, 'session_practice');

      // If questions were generated, save them
      if (result.questions && result.questions.length > 0) {
        await saveQuestions(created.id, result.questions);
      }

      setSavedArticle(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  function handleViewArticle() {
    if (!savedArticle) return;
    onClose();
    navigate(`/library/${savedArticle.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !generating) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-gray-900 rounded-xl border border-border shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{t('daily_article.modal_title')}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {savedArticle ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircleIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{t('daily_article.success')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {savedArticle.title}
                </p>
              </div>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                {t('daily_article.words_hint')}
              </p>
            </div>
          ) : (
            <>
              {/* Deck & Difficulty Metadata Banner */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                    <AcademicCapIcon className="w-4 h-4 text-primary" />
                    <span>{t('daily_article.deck_info')}:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {deckName || t('daily_article.current_deck')}
                    </span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {languageLabel}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 flex items-baseline gap-1.5 pt-1 border-t border-gray-200 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('daily_article.difficulty_info')}:</span>
                  <span className="font-medium text-primary">{difficultyInfo.name}</span>
                  <span className="text-gray-400 text-[11px] truncate">({difficultyInfo.description})</span>
                </div>
              </div>

              {/* Words Management */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('daily_article.words_label')} ({words.length})
                  </label>
                  <span className="text-xs text-gray-400">
                    {t('daily_article.words_all_used')}
                  </span>
                </div>

                <TagInput
                  value={words}
                  onChange={setWords}
                  max={50}
                  placeholder="输入单词按 Enter 添加..."
                  hint={t('daily_article.words_hint')}
                  disabled={generating}
                />
              </div>

              {/* Model Select */}
              <div>
                {providers.length > 0 ? (
                  <Select
                    label={t('daily_article.model_select')}
                    value={selectedProviderIndex}
                    onChange={setSelectedProviderIndex}
                    options={providerOptions}
                    disabled={generating}
                  />
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t('daily_article.model_select')}
                    </label>
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                      {t('daily_article.no_model_hint')}
                    </div>
                  </div>
                )}
              </div>

              {/* Checkbox for questions */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border">
                <input
                  type="checkbox"
                  id="includeQuestions"
                  checked={includeQuestions}
                  onChange={(e) => setIncludeQuestions(e.target.checked)}
                  disabled={generating}
                  className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="includeQuestions" className="text-sm cursor-pointer select-none">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {t('daily_article.include_questions')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('daily_article.include_questions_hint')}
                  </div>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-gray-50/50 dark:bg-gray-900/50">
          {savedArticle ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={handleViewArticle}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <BookOpenIcon className="w-4 h-4" />
                {t('daily_article.view_article')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={generating}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || words.length === 0 || providers.length === 0}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
              >
                {generating ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    {t('daily_article.generating')}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4" />
                    {t('daily_article.generate_btn')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
