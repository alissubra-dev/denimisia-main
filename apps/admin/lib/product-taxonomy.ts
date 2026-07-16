// Custom types and attributes stored in localStorage
const STORAGE_KEY = 'denimisia_custom_taxonomy';

interface CustomTaxonomy {
  customTypes: string[];
  customAttributes: Record<string, string[]>;
}

function loadCustomTaxonomy(): CustomTaxonomy {
  if (typeof window === 'undefined') {
    return { customTypes: [], customAttributes: {} };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { customTypes: [], customAttributes: {} };
  } catch {
    return { customTypes: [], customAttributes: {} };
  }
}

export function saveCustomTaxonomy(data: CustomTaxonomy): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProductTypes(): readonly string[] {
  const custom = loadCustomTaxonomy();
  return ['PANTS', 'SHIRTS', 'JACKETS', ...custom.customTypes] as const;
}

export type ProductType = ReturnType<typeof getProductTypes>[number];

export const UNIVERSAL_ATTRIBUTES = {
  season: {
    required: true,
    multi: true,
    options: ['Summer', 'Winter', 'Spring/Fall', 'All-season'],
  },
  occasion: {
    required: false,
    multi: true,
    options: ['Casual', 'Smart casual', 'Formal', 'Workwear', 'Party'],
  },
  material: {
    required: true,
    multi: true,
    options: [
      'Cotton',
      'Denim',
      'Linen',
      'Leather',
      'Wool',
      'Polyester',
      'Blend',
      'Stretch',
    ],
  },
  pattern: {
    required: false,
    multi: false,
    options: ['Solid', 'Striped', 'Checked', 'Printed', 'Graphic', 'Distressed'],
  },
} as const;

export function getUniversalAttributeOptions(dimension: string): string[] {
  const custom = loadCustomTaxonomy();
  const defaultOptions = (UNIVERSAL_ATTRIBUTES as Record<string, { options: readonly string[] }>)[dimension]?.options || [];
  const customOptions = custom.customAttributes[dimension] || [];
  return [...defaultOptions, ...customOptions];
}

export function getTypeAttributeOptions(type: string, dimension: string): string[] {
  const custom = loadCustomTaxonomy();
  const key = `${type}_${dimension}`;
  const customOptions = custom.customAttributes[key] || [];
  const defaultOptions = (TYPE_ATTRIBUTES_DEFAULT as Record<string, Record<string, { options: readonly string[] }>>)[type]?.[dimension]?.options || [];
  return [...defaultOptions, ...customOptions];
}

export const TYPE_ATTRIBUTES_DEFAULT = {
  PANTS: {
    silhouette: {
      required: true,
      multi: true,
      options: [
        'Skinny',
        'Slim',
        'Straight',
        'Relaxed',
        'Baggy',
        'Wide-leg',
        'Bootcut',
        'Flared',
      ],
    },
    rise: { required: true, multi: false, options: ['Low', 'Mid', 'High'] },
    length: { required: false, multi: false, options: ['Full', 'Cropped', 'Ankle'] },
    wash: {
      required: false,
      multi: false,
      options: ['Raw', 'Dark', 'Mid', 'Light', 'Black', 'Distressed', 'Acid'],
    },
  },
  SHIRTS: {
    silhouette: {
      required: true,
      multi: true,
      options: ['Slim', 'Fitted', 'Regular', 'Relaxed', 'Baggy', 'Oversized', 'Cropped'],
    },
    sleeve: {
      required: true,
      multi: false,
      options: ['Sleeveless', 'Short', '3/4', 'Long'],
    },
    neckline: {
      required: true,
      multi: false,
      options: ['Crew', 'V-neck', 'Polo', 'Button-up', 'Henley', 'Mock-neck'],
    },
    length: {
      required: false,
      multi: false,
      options: ['Regular', 'Cropped', 'Tunic'],
    },
  },
  JACKETS: {
    silhouette: {
      required: true,
      multi: true,
      options: ['Cropped', 'Fitted', 'Regular', 'Oversized'],
    },
    length: {
      required: true,
      multi: false,
      options: ['Cropped', 'Hip-length', 'Mid-length', 'Long'],
    },
    closure: {
      required: true,
      multi: false,
      options: ['Zip', 'Button', 'Snap', 'Open/drape'],
    },
    warmth: {
      required: true,
      multi: false,
      options: ['Light', 'Medium', 'Heavy'],
    },
  },
};

export const SIZE_CHART_DIMENSIONS: Record<ProductType, readonly string[]> = {
  PANTS: ['waist', 'front rise', 'back rise', 'hip', 'thigh', 'length'],
  SHIRTS: ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'neck width', 'cuff opening', 'armhole depth'],
  JACKETS: ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'cuff opening', 'back length', 'armhole depth'],
};

// Backward-compatible exports for existing code
export const PRODUCT_TYPES = ['PANTS', 'SHIRTS', 'JACKETS'] as const;
export const TYPE_ATTRIBUTES = TYPE_ATTRIBUTES_DEFAULT;
