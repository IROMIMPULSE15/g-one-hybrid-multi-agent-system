'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Text from '@/components/Text';

interface VoiceInputButtonProps {
  onTranscriptAction: (transcript: string) => void;
  onErrorAction?: (error: string) => void;
  disabled?: boolean;
  language?: string;
}

export function VoiceInputButton({
  onTranscriptAction,
  onErrorAction,
  disabled = false,
  language = 'en-US'
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setIsFinal(false);
      transcriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          transcriptRef.current += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      // Send interim results for real-time feedback
      if (interim || transcriptRef.current) {
        onTranscriptAction(transcriptRef.current + interim);
      }
    };

    recognition.onerror = (event: any) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      onErrorAction?.(errorMessage);
      console.error(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsFinal(true);
      
      if (transcriptRef.current.trim()) {
        onTranscriptAction(transcriptRef.current.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, onTranscriptAction, onErrorAction]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  return (
    <Button
      onClick={toggleListening}
      disabled={disabled || !recognitionRef.current}
      className={`relative overflow-hidden transition-all duration-300 ${
        isListening 
          ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
          : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
      }`}
      size="lg"
    >
      {isListening ? (
        <>
          <MicOff className="w-5 h-5 mr-2" />
          <Text>Listening...</Text>
        </>
      ) : (
        <>
          <Mic className="w-5 h-5 mr-2" />
          <Text>Speak</Text>
        </>
      )}
    </Button>
  );
}
