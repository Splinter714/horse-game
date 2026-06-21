// Hotbar items. null = empty slot.
// action maps to Horse methods: feed / water / brush / pet
export const ITEMS = [
  { key: 'apple',  label: 'Apple',  icon: 'iconApple',  action: 'feed'  },
  { key: 'hay',    label: 'Hay',    icon: 'iconHay',    action: 'feed'  },
  { key: 'carrot', label: 'Carrot', icon: 'iconCarrot', action: 'feed'  },
  { key: 'treat',  label: 'Treat',  icon: 'iconTreat',  action: 'pet'   },
  { key: 'bucket', label: 'Water',  icon: 'iconWater',  action: 'water' },
  { key: 'brush',  label: 'Brush',  icon: 'iconBrush',  action: 'brush' },
  null,
  null,
];
