import { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { Quiz } from '@/shared/types';

interface QuizComponentProps {
  quiz: Quiz;
  onComplete: (score: number, passed: boolean) => void;
  onCancel: () => void;
}

export function QuizComponent({ quiz, onComplete, onCancel }: QuizComponentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const question = quiz.questions[currentQuestion];

  const handleSelectAnswer = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    setShowResult(true);
    const newAnswers = [...answers, selectedAnswer];
    setAnswers(newAnswers);

    // Wait a moment then move to next question or finish
    setTimeout(() => {
      if (currentQuestion < quiz.questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(null);
        setShowResult(false);
      } else {
        // Quiz complete
        setIsComplete(true);
      }
    }, 2000);
  };

  const calculateScore = () => {
    let correct = 0;
    answers.forEach((answer, index) => {
      if (answer === quiz.questions[index].correctIndex) {
        correct++;
      }
    });
    return Math.round((correct / quiz.questions.length) * 100);
  };

  if (isComplete) {
    const score = calculateScore();
    const passed = score >= quiz.passingScore;

    return (
      <div className="card p-8 text-center">
        <div
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
            passed
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-red-100 dark:bg-red-900/30'
          }`}
        >
          {passed ? (
            <CheckCircleIcon className="w-10 h-10 text-green-600" />
          ) : (
            <XCircleIcon className="w-10 h-10 text-red-600" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {passed ? 'Congratulations!' : 'Try Again'}
        </h2>

        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You scored {score}% ({passed ? 'Passed' : 'Not passed'})
          <br />
          Passing score: {quiz.passingScore}%
        </p>

        <div className="flex justify-center gap-4">
          {!passed && (
            <button
              onClick={() => {
                setCurrentQuestion(0);
                setSelectedAnswer(null);
                setShowResult(false);
                setAnswers([]);
                setIsComplete(false);
              }}
              className="btn-outline"
            >
              Retry Quiz
            </button>
          )}
          <button
            onClick={() => onComplete(score, passed)}
            className="btn-primary"
          >
            {passed ? 'Continue' : 'Back to Lesson'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 mb-8">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Question {currentQuestion + 1} of {quiz.questions.length}
        </span>
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>

      {/* Question */}
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
        {question.question}
      </h3>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = index === question.correctIndex;
          const showCorrect = showResult && isCorrect;
          const showIncorrect = showResult && isSelected && !isCorrect;

          return (
            <button
              key={index}
              onClick={() => handleSelectAnswer(index)}
              disabled={showResult}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                showCorrect
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : showIncorrect
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : isSelected
                  ? 'border-fire-500 bg-fire-50 dark:bg-fire-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    showCorrect
                      ? 'border-green-500 bg-green-500'
                      : showIncorrect
                      ? 'border-red-500 bg-red-500'
                      : isSelected
                      ? 'border-fire-500 bg-fire-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {(showCorrect || (isSelected && !showResult)) && (
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                  )}
                  {showIncorrect && <XCircleIcon className="w-4 h-4 text-white" />}
                </div>
                <span className="text-gray-900 dark:text-white">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showResult && question.explanation && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            selectedAnswer === question.correctIndex
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}
        >
          <p className="text-sm">{question.explanation}</p>
        </div>
      )}

      {/* Submit button */}
      {!showResult && (
        <button
          onClick={handleSubmitAnswer}
          disabled={selectedAnswer === null}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
      )}
    </div>
  );
}
