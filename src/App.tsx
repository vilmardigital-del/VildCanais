/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { CategoryFilter } from './components/CategoryFilter';
import { ChannelCard } from './components/ChannelCard';
import { AddChannelModal } from './components/AddChannelModal';
import { Channel, ChannelCategory } from './types/channel';
import {
  fetchLiveBrazilianChannels,
  getStoredFavorites,
  saveStoredFavorites,
  saveCustomChannels,
  getCustomChannels,
} from './services/iptvService';
import {
  Tv,
  Star,
  Search,
  Sparkles,
  Info,
  SlidersHorizontal,
  Trash2,
  CheckCircle2,
  Maximize,
} from 'lucide-react';

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ChannelCategory>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  // Load favorites & channels on initial mount
  useEffect(() => {
    const loadedFavs = getStoredFavorites();
    setFavorites(loadedFavs);

    const initChannels = async () => {
      setIsSyncing(true);
      const list = await fetchLiveBrazilianChannels();
      setChannels(list);
      setIsSyncing(false);

      // Default selected channel: either first favorite or first channel
      if (list.length > 0) {
        const initialChannel = list.find((c) => loadedFavs.includes(c.id)) || list[0];
        setSelectedChannel(initialChannel);
      }
    };

    initChannels();
  }, []);

  // Save favorites to storage whenever changed
  const handleToggleFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      const isFav = prev.includes(channelId);
      const updated = isFav ? prev.filter((id) => id !== channelId) : [...prev, channelId];
      saveStoredFavorites(updated);
      showToast(isFav ? 'Canal removido dos favoritos' : 'Canal adicionado aos favoritos ⭐');
      return updated;
    });
  }, []);

  // Handle re-syncing from internet
  const handleSync = async () => {
    setIsSyncing(true);
    showToast('Buscando canais abertos atualizados...');
    const list = await fetchLiveBrazilianChannels();
    setChannels(list);
    setIsSyncing(false);
    showToast(`${list.length} canais carregados com sucesso!`);
  };

  // Handle adding user custom channel
  const handleAddChannel = (newChannel: Channel) => {
    const updatedChannels = [newChannel, ...channels];
    setChannels(updatedChannels);

    const customList = [newChannel, ...getCustomChannels()];
    saveCustomChannels(customList);

    setSelectedChannel(newChannel);
    showToast(`Canal "${newChannel.name}" adicionado com sucesso!`);
  };

  // Handle deleting custom channel
  const handleDeleteCustomChannel = (channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    const customList = getCustomChannels().filter((c) => c.id !== channelId);
    saveCustomChannels(customList);
    setFavorites((prev) => prev.filter((id) => id !== channelId));
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(channels.find((c) => c.id !== channelId) || null);
    }
    showToast('Canal personalizado removido');
  };

  // Filter channels based on category and search query
  const filteredChannels = useMemo(() => {
    let result = channels;

    // Filter by Category
    if (selectedCategory === 'favoritos') {
      result = result.filter((ch) => favorites.includes(ch.id));
    } else if (selectedCategory !== 'todos') {
      result = result.filter((ch) => ch.category === selectedCategory);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          (ch.shortName && ch.shortName.toLowerCase().includes(q)) ||
          (ch.region && ch.region.toLowerCase().includes(q)) ||
          (ch.description && ch.description.toLowerCase().includes(q)) ||
          (ch.number && ch.number.toString() === q)
      );
    }

    return result;
  }, [channels, selectedCategory, searchQuery, favorites]);

  // Current channel index in the filtered list
  const currentIndex = useMemo(() => {
    if (!selectedChannel) return -1;
    return filteredChannels.findIndex((c) => c.id === selectedChannel.id);
  }, [selectedChannel, filteredChannels]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredChannels.length - 1;

  const handlePrevChannel = useCallback(() => {
    if (hasPrev) {
      setSelectedChannel(filteredChannels[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, filteredChannels]);

  const handleNextChannel = useCallback(() => {
    if (hasNext) {
      setSelectedChannel(filteredChannels[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, filteredChannels]);

  // Keyboard navigation for channels and fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        handlePrevChannel();
      } else if (e.key === 'ArrowRight') {
        handleNextChannel();
      } else if (e.key === 'f' || e.key === 'F') {
        const video = document.querySelector('video');
        const container = video?.closest('div');
        if (!document.fullscreenElement) {
          container?.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevChannel, handleNextChannel]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 border border-emerald-500/50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSyncing={isSyncing}
        onSync={handleSync}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        totalChannels={channels.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* Video Player Section */}
        <section className="w-full">
          <VideoPlayer
            channel={selectedChannel}
            isFavorite={selectedChannel ? favorites.includes(selectedChannel.id) : false}
            onToggleFavorite={handleToggleFavorite}
            onPrevChannel={handlePrevChannel}
            onNextChannel={handleNextChannel}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        </section>

        {/* Selected Channel Bar & Quick Info */}
        {selectedChannel && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-neutral-900/80 rounded-xl border border-neutral-800/80 shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/70 px-2.5 py-0.5 rounded-md border border-emerald-800/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Transmitindo Agora
              </span>
              <p className="text-xs text-neutral-300">
                <strong className="text-white">{selectedChannel.name}:</strong>{' '}
                {selectedChannel.currentProgram || selectedChannel.description}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-400 shrink-0 w-full sm:w-auto justify-end">
              {/* Prominent Tela Cheia Button in Bar */}
              <button
                onClick={() => {
                  const video = document.querySelector('video');
                  const container = video?.closest('div');
                  if (!document.fullscreenElement) {
                    if (container?.requestFullscreen) {
                      container.requestFullscreen();
                    } else if (video && (video as any).webkitEnterFullscreen) {
                      (video as any).webkitEnterFullscreen();
                    }
                  } else {
                    document.exitFullscreen?.();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow-md shadow-emerald-950 border border-emerald-500/40"
                title="Assistir em Tela Cheia (F)"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span>Tela Cheia</span>
              </button>

              {selectedChannel.isCustom && (
                <button
                  onClick={() => handleDeleteCustomChannel(selectedChannel.id)}
                  className="flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/80 px-2.5 py-1.5 rounded-lg border border-red-800/50 transition cursor-pointer"
                  title="Remover canal personalizado"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Categories Filter Tabs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <CategoryFilter
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              favoritesCount={favorites.length}
              totalChannelsCount={channels.length}
            />
          </div>
        </section>

        {/* Channels Grid Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-200">
                {selectedCategory === 'favoritos'
                  ? 'Meus Canais Favoritos'
                  : selectedCategory === 'todos'
                  ? 'Todos os Canais Abertos'
                  : `Canais: ${selectedCategory.toUpperCase()}`}
              </span>
              <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full text-[11px]">
                {filteredChannels.length} {filteredChannels.length === 1 ? 'canal' : 'canais'}
              </span>
            </div>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-emerald-400 hover:underline cursor-pointer text-[11px]"
              >
                Limpar busca ({filteredChannels.length} encontrados)
              </button>
            )}
          </div>

          {filteredChannels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isActive={selectedChannel?.id === channel.id}
                  isFavorite={favorites.includes(channel.id)}
                  onSelect={(ch) => {
                    setSelectedChannel(ch);
                    // Scroll smoothly to player if on mobile
                    if (window.innerWidth < 768) {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="py-16 text-center bg-neutral-900/30 rounded-2xl border border-neutral-800/80 p-8">
              {selectedCategory === 'favoritos' ? (
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                    <Star className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Nenhum canal favorito ainda</h3>
                  <p className="text-xs text-neutral-400">
                    Clique na estrela ⭐ em qualquer canal para adicioná-lo aos seus favoritos e ter
                    acesso instantâneo sempre que abrir o app.
                  </p>
                  <button
                    onClick={() => setSelectedCategory('todos')}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer mt-2"
                  >
                    Ver todos os canais disponíveis
                  </button>
                </div>
              ) : (
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 mx-auto flex items-center justify-center">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Nenhum canal encontrado</h3>
                  <p className="text-xs text-neutral-400">
                    Não encontramos nenhum canal com o termo &quot;{searchQuery}&quot;. Você pode adicionar
                    um novo link ou limpar o filtro de busca.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Limpar Busca
                    </button>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Adicionar Canal Manualmente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Legal & Open Broadcast Information Banner */}
        <section className="p-4 bg-neutral-900/40 rounded-xl border border-neutral-800/60 text-xs text-neutral-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <p>
              Todos os canais listados transmitem seus sinais abertos e gratuitos oficialmente pela
              internet, em conformidade com o Marco Civil e as diretrizes de radiodifusão pública do
              Brasil.
            </p>
          </div>
          <span className="text-[11px] text-neutral-500 whitespace-nowrap">
            Atualizado automaticamente • Brasil
          </span>
        </section>
      </main>

      {/* Add Custom Channel Modal */}
      <AddChannelModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddChannel={handleAddChannel}
      />
    </div>
  );
}
