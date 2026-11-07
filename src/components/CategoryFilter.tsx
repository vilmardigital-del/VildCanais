import React from 'react';
import {
  Tv,
  Star,
  Newspaper,
  BookOpen,
  Landmark,
  Compass,
  Heart,
  Sprout,
  Music2,
  Grid
} from 'lucide-react';
import { ChannelCategory } from '../types/channel';

interface CategoryFilterProps {
  selectedCategory: ChannelCategory;
  onSelectCategory: (category: ChannelCategory) => void;
  favoritesCount: number;
  totalChannelsCount: number;
}

interface CategoryOption {
  id: ChannelCategory;
  label: string;
  icon: React.ReactNode;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
  favoritesCount,
  totalChannelsCount,
}) => {
  const categories: CategoryOption[] = [
    {
      id: 'todos',
      label: 'Todos',
      icon: <Grid className="w-3.5 h-3.5" />,
    },
    {
      id: 'favoritos',
      label: `Favoritos (${favoritesCount})`,
      icon: <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />,
    },
    {
      id: 'aberta',
      label: 'TV Aberta',
      icon: <Tv className="w-3.5 h-3.5" />,
    },
    {
      id: 'noticias',
      label: 'Notícias',
      icon: <Newspaper className="w-3.5 h-3.5" />,
    },
    {
      id: 'cultura',
      label: 'Cultura & Educação',
      icon: <BookOpen className="w-3.5 h-3.5" />,
    },
    {
      id: 'publico',
      label: 'Público & Institucional',
      icon: <Landmark className="w-3.5 h-3.5" />,
    },
    {
      id: 'regional',
      label: 'Regionais',
      icon: <Compass className="w-3.5 h-3.5" />,
    },
    {
      id: 'religioso',
      label: 'Religiosos',
      icon: <Heart className="w-3.5 h-3.5" />,
    },
    {
      id: 'agro',
      label: 'Agro',
      icon: <Sprout className="w-3.5 h-3.5" />,
    },
    {
      id: 'musica',
      label: 'Música',
      icon: <Music2 className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-1">
      <div className="flex items-center gap-1.5 min-w-max">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
