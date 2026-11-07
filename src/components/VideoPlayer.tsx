import React, { useEffect, useRef, useState } from 'react';
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

  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [needsSoundUnmute, setNeedsSoundUnmute] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset source index and error on channel change
  useEffect(() => {
    setSelectedSourceIndex(0);
    setStreamError(null);
    setNeedsSoundUnmute(false);
  }, [channel?.id]);

  const currentSource: StreamSource | undefined =
    channel?.sources[selectedSourceIndex] || channel?.sources[0];

  // Setup HLS / Video stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource || currentSource.type === 'youtube' || currentSource.type === 'iframe') {
      return;
    }

    setIsLoading(true);
    setStreamError(null);

    // Destroy existing Hls instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Always route through backend stream proxy to bypass CORS & Mixed Content
    const proxiedStreamUrl = getStreamProxyUrl(currentSource.url);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 10000,
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
              console.warn('Network error in stream, retrying...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Media error in stream, recovering...', data);
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setStreamError('O sinal desta transmissão está temporariamente indisponível na emissora.');
              setIsLoading(false);
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
        setStreamError('Não foi possível carregar a transmissão no momento.');
        setIsLoading(false);
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
    };
  }, [channel?.id, selectedSourceIndex, currentSource]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4000);
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

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        console.error('Fullscreen error:', err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  const reloadStream = () => {
    if (currentSource) {
      setStreamError(null);
      setIsLoading(true);
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
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-neutral-800/80 group ${
        isFullscreen ? 'rounded-none border-0' : ''
      }`}
    >
      {/* Video or YouTube Iframe */}
      {isYouTube ? (
        <iframe
          src={`${currentSource.url}${currentSource.url.includes('?') ? '&' : '?'}autoplay=1&mute=${isMuted ? 1 : 0}`}
          title={channel.name}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black cursor-pointer"
          playsInline
          onClick={togglePlay}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Unmute Sound Alert (Browser Autoplay Requirement) */}
      {needsSoundUnmute && !isYouTube && (
        <div className="absolute top-16 left-4 z-30">
          <button
            onClick={unmuteSound}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xl animate-bounce cursor-pointer border border-emerald-400/40"
          >
            <Volume1 className="w-4 h-4" />
            <span>Toque para ativar o som 🔊</span>
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && !streamError && !isYouTube && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none transition-opacity z-20">
          <div className="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin mb-3" />
          <span className="text-xs uppercase tracking-wider font-semibold text-neutral-300">
            Sintonizando sinal ao vivo...
          </span>
        </div>
      )}

      {/* Stream Error Overlay */}
      {streamError && !isYouTube && (
        <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
          <h4 className="text-base font-semibold text-white">Sinal Temporariamente Indisponível</h4>
          <p className="text-xs text-neutral-400 max-w-md mt-1 mb-4">{streamError}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {channel.sources.length > 1 && (
              <button
                onClick={() => {
                  const nextIdx = (selectedSourceIndex + 1) % channel.sources.length;
                  setSelectedSourceIndex(nextIdx);
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                Alternar Servidor ({selectedSourceIndex + 1}/{channel.sources.length})
              </button>
            )}
            <button
              onClick={reloadStream}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Reconectar
            </button>
          </div>
        </div>
      )}

      {/* Top Bar Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-700 p-0.5 flex items-center justify-center shadow-md">
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
              <h2 className="text-base font-bold text-white tracking-tight drop-shadow-sm">
                {channel.name}
              </h2>
            </div>
            <p className="text-xs text-neutral-300 line-clamp-1 drop-shadow-sm">
              {channel.currentProgram || channel.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {channel.website && (
            <a
              href={channel.website}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer border border-neutral-700/50"
              title="Site Oficial da Emissora"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={() => onToggleFavorite(channel.id)}
            className={`p-2 rounded-lg transition cursor-pointer border ${
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
      {!isPlaying && !isLoading && !isYouTube && (
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-emerald-600/90 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl z-20 cursor-pointer"
        >
          <Play className="w-8 h-8 ml-1" />
        </button>
      )}

      {/* Bottom Bar Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-3 z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left Controls: Prev/Next Channel, Play/Pause, Live indicator */}
        <div className="flex items-center gap-2">
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

          <div className="hidden sm:flex items-center gap-1.5 ml-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/40">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Sinal Aberto HD</span>
          </div>
        </div>

        {/* Center: Mirror / Source switch if available */}
        {channel.sources.length > 1 && (
          <div className="flex items-center gap-1.5 bg-neutral-900/90 px-2 py-1 rounded-lg border border-neutral-700/60 text-xs">
            <Layers className="w-3 h-3 text-neutral-400" />
            <span className="text-neutral-400 hidden sm:inline">Sinal:</span>
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

        {/* Right Controls: Volume, Reload, Fullscreen */}
        <div className="flex items-center gap-2">
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
                className="w-16 sm:w-20 accent-emerald-500 cursor-pointer hidden group-hover/vol:block sm:block h-1.5 bg-neutral-700 rounded-lg"
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

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 hover:text-white transition cursor-pointer"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
