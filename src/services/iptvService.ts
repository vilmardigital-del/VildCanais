import { Channel, ChannelCategory, StreamSource } from '../types/channel';
import { DEFAULT_CHANNELS } from '../data/defaultChannels';

const STORAGE_KEY_CHANNELS = 'brasil_tv_cached_channels_v4';
const STORAGE_KEY_FAVORITES = 'brasil_tv_favorites_v4';
const STORAGE_KEY_CUSTOM = 'brasil_tv_custom_channels_v4';
const STORAGE_KEY_LAST_SYNC = 'brasil_tv_last_sync_time';

export function getStreamProxyUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('/api/stream-proxy')) return rawUrl;
  if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')) return rawUrl;
  return `/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`;
}

export function getStoredFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (!raw) {
      // Default initial favorites: top popular Brazilian open channels
      return ['sbt-nacional', 'tv-brasil', 'record-news', 'sbt-news', 'tv-cultura', 'rede-tv', 'tv-camara'];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler favoritos do localStorage', err);
    return ['sbt-nacional', 'tv-brasil'];
  }
}

export function saveStoredFavorites(favorites: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  } catch (err) {
    console.error('Erro ao salvar favoritos', err);
  }
}

export function getCustomChannels(): Channel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Erro ao ler canais personalizados', err);
    return [];
  }
}

export function saveCustomChannels(channels: Channel[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(channels));
  } catch (err) {
    console.error('Erro ao salvar canais personalizados', err);
  }
}

function categorizeByNameAndGroup(name: string, group: string): ChannelCategory {
  const text = `${name} ${group}`.toLowerCase();
  if (
    text.includes('notícia') ||
    text.includes('news') ||
    text.includes('jornal') ||
    text.includes('cnn') ||
    text.includes('bandnews')
  ) {
    return 'noticias';
  }
  if (
    text.includes('cultura') ||
    text.includes('educa') ||
    text.includes('futura') ||
    text.includes('escola') ||
    text.includes('document')
  ) {
    return 'cultura';
  }
  if (
    text.includes('senado') ||
    text.includes('câmara') ||
    text.includes('camara') ||
    text.includes('gov') ||
    text.includes('justiça') ||
    text.includes('assembleia') ||
    text.includes('alep') ||
    text.includes('alesp')
  ) {
    return 'publico';
  }
  if (
    text.includes('relig') ||
    text.includes('vida') ||
    text.includes('aparecida') ||
    text.includes('canção') ||
    text.includes('evang') ||
    text.includes('gospel') ||
    text.includes('advent') ||
    text.includes('oração') ||
    text.includes('igreja') ||
    text.includes('tempo')
  ) {
    return 'religioso';
  }
  if (
    text.includes('agro') ||
    text.includes('terra') ||
    text.includes('campo') ||
    text.includes('rural') ||
    text.includes('boi')
  ) {
    return 'agro';
  }
  if (
    text.includes('music') ||
    text.includes('música') ||
    text.includes('som') ||
    text.includes('rádio') ||
    text.includes('radio') ||
    text.includes('clip')
  ) {
    return 'musica';
  }
  if (
    text.includes('tv brasil') ||
    text.includes('sbt') ||
    text.includes('band') ||
    text.includes('globo') ||
    text.includes('record') ||
    text.includes('redetv') ||
    text.includes('gazeta') ||
    text.includes('rbtv')
  ) {
    return 'aberta';
  }
  return 'regional';
}

function parseM3uToChannels(m3uText: string): Channel[] {
  const lines = m3uText.split('\n');
  const parsedChannels: Channel[] = [];
  let currentInfo: {
    name: string;
    logo: string;
    group: string;
    id: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const logo = logoMatch ? logoMatch[1] : '';

      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const group = groupMatch ? groupMatch[1] : '';

      const commaIdx = line.lastIndexOf(',');
      const rawName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Canal Aberto BR';

      const cleanName = rawName.replace(/\[.*?\]|\(.*?\)/g, '').trim() || rawName;
      const channelId = 'auto-' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);

      currentInfo = {
        name: cleanName,
        logo:
          logo ||
          'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=160&q=80',
        group,
        id: channelId,
      };
    } else if (line.startsWith('http') && currentInfo) {
      const streamUrl = line;
      const category = categorizeByNameAndGroup(currentInfo.name, currentInfo.group);

      const stream: StreamSource = {
        label: 'Stream Ao Vivo',
        url: streamUrl,
        type: streamUrl.includes('youtube.com') ? 'youtube' : 'hls',
      };

      parsedChannels.push({
        id: currentInfo.id,
        name: currentInfo.name,
        shortName: currentInfo.name.length > 20 ? currentInfo.name.substring(0, 18) + '...' : currentInfo.name,
        category,
        logo: currentInfo.logo,
        description: `Canal aberto transmitindo ao vivo na internet (${currentInfo.group || 'Geral'}).`,
        region: 'Brasil',
        sources: [stream],
        website: 'https://brasil.gov.br',
      });

      currentInfo = null;
    }
  }

  return parsedChannels;
}

export async function fetchLiveBrazilianChannels(): Promise<Channel[]> {
  const curated = [...DEFAULT_CHANNELS];
  const custom = getCustomChannels();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('https://iptv-org.github.io/iptv/countries/br.m3u', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const m3uData = await response.text();
      const fetchedChannels = parseM3uToChannels(m3uData);

      const existingNames = new Set(
        curated.map((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      );

      const newDiscovered: Channel[] = [];
      for (const ch of fetchedChannels) {
        const norm = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!existingNames.has(norm) && ch.sources.length > 0) {
          existingNames.add(norm);
          newDiscovered.push(ch);
        }
      }

      const merged = [...custom, ...curated, ...newDiscovered];
      localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(merged));
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      return merged;
    }
  } catch {
    // Graceful fallback
  }

  const cached = localStorage.getItem(STORAGE_KEY_CHANNELS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fallback
    }
  }

  const allInitial = [...custom, ...curated];
  localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(allInitial));
  localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
  return allInitial;
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
}
