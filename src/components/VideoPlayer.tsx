import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RefreshCw,
  Star,
  Tv,
  Layers,
  ChevronLeft,
  ChevronRight,
  Radio,
  ExternalLink,
  AlertCircle,
  Volume1,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { Channel, StreamSource } from '../types/channel';
import { getStreamProxyUrl } from '../services/iptvService';

interface VideoPlayerProps {
  channel: Channel | null;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  isFavorite,
  onToggleFavorite,
  onPrevChannel,
  onNextChannel,
  hasPrev,
  hasNext,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReceivingVideo, setIsReceivingVideo] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [needsSoundUnmute, setNeedsSoundUnmute] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset states on channel change
  useEffect(() => {
    setSelectedSourceIndex(0);
    setStreamError(null);
    setIsReceivingVideo(false);
    setIsLoading(true);
    setNeedsSoundUnmute(false);
  }, [channel?.id]);

  const currentSource: StreamSource | undefined =
    channel?.sources[selectedSourceIndex] || channel?.sources[0];

  // Fullscreen toggle with iOS Safari fallback
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;

    // Check if currently fullscreen
    const isCurrentlyFullscreen =
      !!document.fullscreenElement ||
      !!(document as any).webkitFullscreenElement ||
      !!(document as any).mozFullScreenElement ||
      !!(document as any).msFullscreenElement;

    if (!isCurrentlyFullscreen) {
      if (container?.requestFullscreen) {
        try {
          await container.requestFullscreen();
        } catch {
          // Fallback to video element on mobile Safari
          if (video && (video as any).webkitEnterFullscreen) {
            (video as any).webkitEnterFullscreen();
          }
        }
      } else if ((container as any)?.webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if (video && (video as any).webkitEnterFullscreen) {
        // iOS Safari iPhone
        (video as any).webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, []);

  // Listen to fullscreen changes across all vendor prefixes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement ||
        !!(document as any).mozFullScreenElement ||
        !!(document as any).msFullscreenElement;
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Setup HLS / Video stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource || currentSource.type === 'youtube' || currentSource.type === 'iframe') {
      return;
    }

    setIsLoading(true);
    setIsReceivingVideo(false);
    setStreamError(null);

    // Clean up existing Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Clean up previous watchdog
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }

    // Start 8-second watchdog timer: if still no video frames, try alternate mirror or report
    watchdogTimerRef.current = setTimeout(() => {
      if (video.readyState < 2 && video.currentTime === 0) {
        if (channel && channel.sources.length > selectedSourceIndex + 1) {
          console.log('Stream lento, tentando servidor alternativo automaticamente...');
          setSelectedSourceIndex((prev) => prev + 1);
        } else {
          setIsLoading(false);
          setStreamError('O sinal está demorando para responder. Clique abaixo para tentar reconectar.');
        }
      }
    }, 8000);

    const proxiedStreamUrl = getStreamProxyUrl(currentSource.url);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 800,
        levelLoadingTimeOut: 12000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 5,
      });

      hlsRef.current = hls;
      hls.loadSource(proxiedStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              // Browser Autoplay Policy: mute and retry play
              video.muted = true;
              setIsMuted(true);
              setNeedsSoundUnmute(true);
              video
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {});
            });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('Network error in stream, recovering...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Media error in stream, recovering...', data);
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (channel && channel.sources.length > selectedSourceIndex + 1) {
                // Auto-fallback to next mirror if available
                setSelectedSourceIndex((prev) => prev + 1);
              } else {
                setStreamError('Transmissão temporariamente fora do ar na emissora.');
                setIsLoading(false);
              }
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = proxiedStreamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            video.muted = true;
            setIsMuted(true);
            setNeedsSoundUnmute(true);
            video.play().catch(() => {});
          });
      });

      video.addEventListener('error', () => {
        if (channel && channel.sources.length > selectedSourceIndex + 1) {
          setSelectedSourceIndex((prev) => prev + 1);
        } else {
          setStreamError('Não foi possível reproduzir a transmissão no momento.');
          setIsLoading(false);
        }
      });
    } else {
      setStreamError('Formato de transmissão não suportado pelo navegador.');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, [channel?.id, selectedSourceIndex, currentSource]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && isReceivingVideo) {
        setShowControls(false);
      }
    }, 4500);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      setNeedsSoundUnmute(false);
    }
  };

  const unmuteSound = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    setIsMuted(false);
    setNeedsSoundUnmute(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else {
        videoRef.current.muted = false;
        setIsMuted(false);
        setNeedsSoundUnmute(false);
      }
    }
  };

  const reloadStream = () => {
    if (currentSource) {
      setStreamError(null);
      setIsLoading(true);
      setIsReceivingVideo(false);
      const proxied = getStreamProxyUrl(currentSource.url);
      if (hlsRef.current) {
        hlsRef.current.loadSource(proxied);
        hlsRef.current.startLoad();
      } else if (videoRef.current) {
        videoRef.current.load();
      }
    }
  };

  if (!channel) {
    return (
      <div className="relative w-full aspect-video bg-neutral-950 rounded-2xl flex flex-col items-center justify-center border border-neutral-800 text-neutral-400 p-6 shadow-2xl">
        <Tv className="w-16 h-16 text-neutral-600 mb-4 animate-pulse" />
        <h3 className="text-lg font-semibold text-neutral-200">Nenhum canal selecionado</h3>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm text-center">
          Selecione um canal da lista abaixo para começar a assistir à transmissão aberta em tempo real.
        </p>
      </div>
    );
  }

  const isYouTube = currentSource?.type === 'youtube';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onDoubleClick={toggleFullscreen}
      className={`relative w-full aspect-video bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800/80 group select-none ${
        isFullscreen ? 'rounded-none border-0' : ''
      }`}
    >
      {/* Video or YouTube Iframe */}
      {isYouTube ? (
        <iframe
          src={`${currentSource.url}${currentSource.url.includes('?') ? '&' : '?'}autoplay=1&mute=${isMuted ? 1 : 0}`}
          title={channel.name}
          className="w-full h-full border-0 relative z-10"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          className={`w-full h-full object-contain bg-black cursor-pointer relative z-10 transition-opacity duration-500 ${
            isReceivingVideo ? 'opacity-100' : 'opacity-0'
          }`}
          playsInline
          webkit-playsinline="true"
          x5-video-player-type="h5"
          onClick={togglePlay}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setIsReceivingVideo(true);
            setIsPlaying(true);
          }}
          onLoadedData={() => {
            setIsLoading(false);
            setIsReceivingVideo(true);
          }}
          onTimeUpdate={() => {
            if (!isReceivingVideo && videoRef.current && videoRef.current.currentTime > 0) {
              setIsReceivingVideo(true);
              setIsLoading(false);
            }
          }}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* AMBIENT POSTER / BACKDROP - PREVENTS BLACK SCREEN ENTIRELY */}
      {!isReceivingVideo && !streamError && !isYouTube && (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center p-6 bg-radial from-neutral-900 to-black overflow-hidden">
          {/* Subtle logo blur in background */}
          <div
            className="absolute inset-0 opacity-15 scale-125 filter blur-2xl bg-center bg-no-repeat bg-contain"
            style={{ backgroundImage: `url(${channel.logo})` }}
          />

          <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
            <div className="relative w-24 h-24 rounded-2xl bg-neutral-900/90 border-2 border-emerald-500/40 p-2 shadow-2xl shadow-emerald-950 flex items-center justify-center mb-4">
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=160&q=80';
                }}
              />
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 animate-ping" />
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-neutral-950" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mb-1">{channel.name}</h3>
            <p className="text-xs text-neutral-400 line-clamp-1 mb-4">
              {channel.currentProgram || channel.description}
            </p>

            <div className="flex items-center gap-2.5 px-4 py-2 bg-neutral-900/90 border border-neutral-800 rounded-full shadow-lg">
              <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span className="text-xs font-semibold text-emerald-400">
                Sintonizando sinal ao vivo...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Unmute Sound Alert (Browser Autoplay Requirement) */}
      {needsSoundUnmute && !isYouTube && (
        <div className="absolute top-16 left-4 z-30 animate-bounce">
          <button
            onClick={unmuteSound}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-2xl cursor-pointer border border-emerald-400/50"
          >
            <Volume1 className="w-4 h-4" />
            <span>Toque para ativar o som 🔊</span>
          </button>
        </div>
      )}

      {/* Stream Error Overlay */}
      {streamError && !isYouTube && (
        <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">Sinal Temporariamente Indisponível</h4>
          <p className="text-xs text-neutral-400 max-w-md mb-5">{streamError}</p>
          <div className="flex flex-wrap gap-2.5 justify-center">
            {channel.sources.length > 1 && (
              <button
                onClick={() => {
                  const nextIdx = (selectedSourceIndex + 1) % channel.sources.length;
                  setSelectedSourceIndex(nextIdx);
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer border border-neutral-700"
              >
                <Layers className="w-3.5 h-3.5" />
                Trocar Servidor ({selectedSourceIndex + 1}/{channel.sources.length})
              </button>
            )}
            <button
              onClick={reloadStream}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Reconectar
            </button>
            <button
              onClick={onNextChannel}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              Próximo Canal
            </button>
          </div>
        </div>
      )}

      {/* Top Bar Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-700 p-0.5 flex items-center justify-center shadow-md">
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-full h-full object-contain rounded-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=160&q=80';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                AO VIVO
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight drop-shadow-sm">
                {channel.name}
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-300 line-clamp-1 drop-shadow-sm">
              {channel.currentProgram || channel.description}
            </p>
          </div>
        </div>

        {/* Top Actions: Tela Cheia Destaque, Site Oficial & Favorito */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Prominent Tela Cheia Button in Header */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950 cursor-pointer"
            title="Expandir para Tela Cheia"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tela Cheia</span>
          </button>

          {channel.website && (
            <a
              href={channel.website}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer border border-neutral-700/50"
              title="Site Oficial da Emissora"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={() => onToggleFavorite(channel.id)}
            className={`p-1.5 sm:p-2 rounded-lg transition cursor-pointer border ${
              isFavorite
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                : 'bg-neutral-900/80 border-neutral-700/50 text-neutral-300 hover:text-amber-400'
            }`}
            title={isFavorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Center Big Play Button when Paused */}
      {!isPlaying && isReceivingVideo && !isYouTube && (
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-emerald-600/95 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl z-20 cursor-pointer"
        >
          <Play className="w-8 h-8 ml-1" />
        </button>
      )}

      {/* Bottom Bar Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between gap-3 z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left Controls: Prev/Next Channel, Play/Pause, Live indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onPrevChannel}
            disabled={!hasPrev}
            className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Canal Anterior (Seta Esquerda)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {!isYouTube && (
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-white transition cursor-pointer"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={onNextChannel}
            disabled={!hasNext}
            className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            title="Próximo Canal (Seta Direita)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="hidden md:flex items-center gap-1.5 ml-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/40">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Sinal Aberto HD</span>
          </div>
        </div>

        {/* Center: Mirror / Source switch if available */}
        {channel.sources.length > 1 && (
          <div className="flex items-center gap-1.5 bg-neutral-900/90 px-2.5 py-1 rounded-lg border border-neutral-700/60 text-xs">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400 hidden sm:inline">Servidor:</span>
            <select
              value={selectedSourceIndex}
              onChange={(e) => setSelectedSourceIndex(Number(e.target.value))}
              className="bg-transparent text-neutral-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              {channel.sources.map((s, idx) => (
                <option key={idx} value={idx} className="bg-neutral-900 text-white">
                  {s.label} {s.quality ? `(${s.quality})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Right Controls: Volume, Reload, Fullscreen Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isYouTube && (
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 transition cursor-pointer"
                title={isMuted ? 'Desmutar' : 'Mutar'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 accent-emerald-500 cursor-pointer hidden group-hover/vol:block sm:block h-1.5 bg-neutral-700 rounded-lg"
                title="Ajustar Volume"
              />
            </div>
          )}

          <button
            onClick={reloadStream}
            className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 hover:text-white transition cursor-pointer"
            title="Recarregar Transmissão"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Dedicated Fullscreen button in control bar */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition cursor-pointer border border-neutral-700"
            title={isFullscreen ? 'Sair da Tela Cheia (F)' : 'Tela Cheia (F)'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
