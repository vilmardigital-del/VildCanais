import React from 'react';
import { Star, Play, Radio, MapPin } from 'lucide-react';
import { Channel } from '../types/channel';

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
}) => {
  return (
    <div
      onClick={() => onSelect(channel)}
      className={`group relative rounded-xl p-3 sm:p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between select-none ${
        isActive
          ? 'bg-neutral-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50'
          : 'bg-neutral-900/60 hover:bg-neutral-850 border-neutral-800/80 hover:border-neutral-700/80 shadow-sm'
      }`}
    >
      <div>
        {/* Top header: Logo + Favorite button */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="relative w-12 h-12 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden flex items-center justify-center p-1 shrink-0 group-hover:scale-105 transition-transform">
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-full h-full object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=160&q=80';
              }}
            />
            {isActive && (
              <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-xs flex items-center justify-center">
                <Play className="w-5 h-5 text-emerald-400 fill-emerald-400 animate-pulse" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(channel.id);
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isFavorite
                ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                : 'text-neutral-500 hover:text-amber-400 hover:bg-neutral-800'
            }`}
            title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
        </div>

        {/* Channel Details */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <h3
              className={`text-sm font-bold line-clamp-1 transition-colors ${
                isActive ? 'text-emerald-400' : 'text-neutral-100 group-hover:text-emerald-300'
              }`}
            >
              {channel.name}
            </h3>
            {channel.number && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 shrink-0">
                CH {channel.number}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
            {channel.description}
          </p>
        </div>
      </div>

      {/* Footer Info: Region / Live Status */}
      <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400 mt-2">
        <span className="flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
          <span className="truncate">{channel.region || 'Brasil'}</span>
        </span>

        {isActive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            No Ar
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-neutral-500">
            <Radio className="w-3 h-3" />
            Gratuito
          </span>
        )}
      </div>
    </div>
  );
};
