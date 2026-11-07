import React, { useState } from 'react';
import { X, Plus, Tv, Link, Tag, Image, CheckCircle, MapPin } from 'lucide-react';
import { Channel, ChannelCategory, StreamSource } from '../types/channel';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChannel: (newChannel: Channel) => void;
}

export const AddChannelModal: React.FC<AddChannelModalProps> = ({
  isOpen,
  onClose,
  onAddChannel,
}) => {
  const [name, setName] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [category, setCategory] = useState<ChannelCategory>('aberta');
  const [region, setRegion] = useState('Nacional');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do canal.');
      return;
    }
    if (!streamUrl.trim()) {
      setError('Por favor, insira a URL da transmissão (m3u8 ou YouTube).');
      return;
    }

    const isYoutube = streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be');
    let finalStreamUrl = streamUrl.trim();

    if (isYoutube && streamUrl.includes('watch?v=')) {
      const videoId = streamUrl.split('watch?v=')[1]?.split('&')[0];
      if (videoId) {
        finalStreamUrl = `https://www.youtube.com/embed/${videoId}`;
      }
    }

    const source: StreamSource = {
      label: 'Stream Personalizado',
      url: finalStreamUrl,
      type: isYoutube ? 'youtube' : 'hls',
      quality: 'HD',
    };

    const newChannel: Channel = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      shortName: name.trim().slice(0, 16),
      category,
      region: region.trim() || 'Brasil',
      logo:
        logoUrl.trim() ||
        'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=160&q=80',
      description: description.trim() || 'Canal de TV aberto adicionado pelo usuário.',
      sources: [source],
      isCustom: true,
    };

    onAddChannel(newChannel);
    setName('');
    setStreamUrl('');
    setLogoUrl('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative text-neutral-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Adicionar Canal Aberto</h2>
            <p className="text-xs text-neutral-400">
              Insira o link de transmissão (HLS .m3u8 ou YouTube Live)
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/60 text-red-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Nome do Canal *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: TV Regional SP, SBT Local..."
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Link da Transmissão (m3u8 ou YouTube) *
            </label>
            <div className="relative">
              <Link className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="url"
                required
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://exemplo.com/stream/playlist.m3u8"
                className="w-full pl-9 pr-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono text-xs transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Categoria
              </label>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ChannelCategory)}
                  className="w-full pl-8 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                >
                  <option value="aberta">TV Aberta</option>
                  <option value="noticias">Notícias</option>
                  <option value="cultura">Cultura & Educação</option>
                  <option value="publico">Público / Institucional</option>
                  <option value="regional">Regional</option>
                  <option value="religioso">Religioso</option>
                  <option value="agro">Agro</option>
                  <option value="musica">Música</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Estado / Região
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Ex: São Paulo, Brasil..."
                  className="w-full pl-8 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              URL do Logo / Ícone (opcional)
            </label>
            <div className="relative">
              <Image className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://exemplo.com/logo.png"
                className="w-full pl-9 pr-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-900/40"
            >
              <Plus className="w-4 h-4" />
              Salvar Canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
