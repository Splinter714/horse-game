export const ALL_ITEMS = [
  { key: 'apple',  label: 'Apple',  icon: 'iconApple',  action: 'feed',   category: 'food' },
  { key: 'hay',    label: 'Hay',    icon: 'iconHay',    action: 'feed',   category: 'food' },
  { key: 'carrot', label: 'Carrot', icon: 'iconCarrot', action: 'feed',   category: 'food' },
  { key: 'treat',  label: 'Treat',  icon: 'iconTreat',  action: 'pet',    category: 'food' },
  { key: 'seed',   label: 'Seeds',  icon: 'iconSeed',   action: 'seed',   category: 'food' },
  { key: 'bucket', label: 'Water',  icon: 'iconWater',  action: 'water',  category: 'tool' },
  { key: 'brush',  label: 'Brush',  icon: 'iconBrush',  action: 'brush',  category: 'tool' },
  { key: 'saddle', label: 'Saddle', icon: 'iconSaddle', action: 'ride',   category: 'tool' },
  { key: 'lead',   label: 'Lead',   icon: 'iconLead',   action: 'lead',   category: 'tool' },
  { key: 'basket', label: 'Basket', icon: 'iconBasket', action: 'basket', category: 'tool' },
];

export const ITEM_MAP = Object.fromEntries(ALL_ITEMS.map(i => [i.key, i]));

// backward compat
export const ITEMS = ALL_ITEMS;
