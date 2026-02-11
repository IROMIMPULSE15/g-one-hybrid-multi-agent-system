'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Text from '@/components/Text';
import { removeEmojis } from '@/lib/emoji-utils';

interface TextToSpeechProps {
  text: string;
  disabled?: boolean;
  autoPlay?: boolean;
  rate?: number;
  pitch?: number;
  voice?: string;
}

export function TextToSpeech({
  text,
  disabled = false,
  autoPlay = false,
  rate = 1,
  pitch = 1,
  voice
}: TextToSpeechProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const synthRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (autoPlay && text && !disabled) {
      speak();
    }

    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [text]);

  const speak = () => {
    if (!text || disabled) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Remove emojis before speaking
    const cleanText = removeEmojis(text);
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Set voice if available
    if (voice) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find((v) => v.name === voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      setIsSpeaking(false);
    };

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const togglePause = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={speak}
        disabled={disabled || isSpeaking}
        size="sm"
        className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
      >
        <Volume2 className="w-4 h-4 mr-1" />
        <Text>Speak</Text>
      </Button>

      {isSpeaking && (
        <>
          <Button
            onClick={togglePause}
            size="sm"
            variant="outline"
          >
            <Text>{isPaused ? '▶️ Resume' : '⏸️ Pause'}</Text>
          </Button>

          <Button
            onClick={stop}
            size="sm"
            variant="outline"
            className="text-red-500 hover:text-red-600"
          >
            <VolumeX className="w-4 h-4 mr-1" />
            <Text>Stop</Text>
          </Button>
        </>
      )}
    </div>
  );
}
