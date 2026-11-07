export type ChannelCategory =
  | 'todos'
  | 'favoritos'
  | 'aberta'
  | 'noticias'
  | 'cultura'
  | 'publico'
  | 'regional'
  | 'religioso'
  | 'agro'
  | 'musica';

export interface StreamSource {
  label: string;
  url: string;
  type: 'hls' | 'youtube' | 'iframe' | 'mp4';
  quality?: string;
}

export interface Channel {
  id: string;
  name: string;
  shortName?: string;
  category: ChannelCategory;
  logo: string;
  description: string;
  sources: StreamSource[];
  region?: string;
  number?: number;
  isCustom?: boolean;
  website?: string;
  currentProgram?: string;
}
