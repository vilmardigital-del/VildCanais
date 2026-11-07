import React from 'react';
import { Tv, Search, Plus, RefreshCw, X, Radio } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSyncing: boolean;
  onSync: () => void;
  onOpenAddModal: () => void;
  totalChannels: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  isSyncing,
  onSync,
  onOpenAddModal,
  totalChannels,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Brand identity */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-amber-400 p-0.5 shadow-md shadow-emerald-950 flex items-center justify-center">
              <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                <Tv className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  Brasil <span className="text-emerald-400">TV</span> Aberta
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  AO VIVO
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {totalChannels} canais gratuitos transmitindo no Brasil
              </p>
            </div>
          </div>

          {/* Mobile quick actions */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Sincronizar canais da internet"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={onOpenAddModal}
              className="p-2 rounded-lg bg-emerald-600 text-white font-semibold transition cursor-pointer"
              title="Adicionar Canal"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="w-full md:max-w-md relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome (ex: SBT, Cultura, Notícias)..."
            className="w-full pl-9 pr-9 py-2 bg-neutral-900/90 hover:bg-neutral-900 focus:bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white transition cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Desktop actions: Sync & Add */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            title="Atualizar canais e buscar transmissões online"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSyncing ? 'Buscando...' : 'Atualizar Canais'}</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Canal</span>
          </button>
        </div>
      </div>
    </header>
  );
};
