import avatar01 from '../assets/images/avatar_3d_01_1788580536875.jpg';
import avatar02 from '../assets/images/avatar_3d_02_1788580553460.jpg';
import avatar03 from '../assets/images/avatar_3d_03_1788580568472.jpg';
import avatar04 from '../assets/images/avatar_3d_04_1788580582312.jpg';
import avatar05 from '../assets/images/avatar_3d_05_1788580602174.jpg';
import avatar06 from '../assets/images/avatar_3d_06_1788580615219.jpg';
import avatar07 from '../assets/images/avatar_3d_07_1788580630366.jpg';
import avatar08 from '../assets/images/avatar_3d_08_1788580644674.jpg';
import avatar09 from '../assets/images/avatar_3d_09_1788580663131.jpg';
import avatar10 from '../assets/images/avatar_3d_10_1788580675084.jpg';
import avatar11 from '../assets/images/avatar_3d_11_1788580705520.jpg';
import avatar12 from '../assets/images/avatar_3d_12_1788580718469.jpg';
import neutralDefaultAvatar from '../assets/images/avatar_neutral_default_1788580689661.jpg';

export interface AvatarOption {
  id: string;
  name: string;
  description: string;
  url: string;
}

export const NEUTRAL_DEFAULT_AVATAR_URL = neutralDefaultAvatar;
export const NEUTRAL_DEFAULT_AVATAR = neutralDefaultAvatar;

export const DR_RADAR_AVATARS: AvatarOption[] = [
  {
    id: 'avatar_01',
    name: 'Elena',
    description: 'Wavy dark hair, teal crewneck, friendly smile',
    url: avatar01,
  },
  {
    id: 'avatar_02',
    name: 'Marcus',
    description: 'Short textured fade, light grey crewneck, kind warm eyes',
    url: avatar02,
  },
  {
    id: 'avatar_03',
    name: 'Mei',
    description: 'Straight dark hair, wireframe glasses, crisp collar',
    url: avatar03,
  },
  {
    id: 'avatar_04',
    name: 'Dev',
    description: 'Trimmed beard, navy knit, warm approachable smile',
    url: avatar04,
  },
  {
    id: 'avatar_05',
    name: 'Rowan',
    description: 'Wavy sandy-brown hair, sage green knit, welcoming expression',
    url: avatar05,
  },
  {
    id: 'avatar_06',
    name: 'Evelyn',
    description: 'Short silver hair, soft lavender cardigan, gentle smile',
    url: avatar06,
  },
  {
    id: 'avatar_07',
    name: 'Zahra',
    description: 'Slate-blue headscarf, white top, warm caring expression',
    url: avatar07,
  },
  {
    id: 'avatar_08',
    name: 'Mateo',
    description: 'Short wavy dark hair, ocean blue knit, approachable demeanor',
    url: avatar08,
  },
  {
    id: 'avatar_09',
    name: 'Arthur',
    description: 'Silver hair, thin glasses, charcoal cardigan, kind smile',
    url: avatar09,
  },
  {
    id: 'avatar_10',
    name: 'Nia',
    description: 'Braided crown bun, sky-blue sweater, confident smile',
    url: avatar10,
  },
  {
    id: 'avatar_11',
    name: 'Kai',
    description: 'Curly dark hair, warm terracotta sweater, friendly gaze',
    url: avatar11,
  },
  {
    id: 'avatar_12',
    name: 'Lucas',
    description: 'Sandy blonde hair, forest-green crewneck, welcoming smile',
    url: avatar12,
  },
];

export function getAvatarById(id: string | null | undefined): AvatarOption | undefined {
  if (!id) return undefined;
  return DR_RADAR_AVATARS.find((a) => a.id === id);
}

export function resolveUserAvatarUrl(
  userOrType?:
    | {
        profilePictureType?: 'uploaded' | 'avatar' | 'none';
        profilePicture?: string | null;
        avatarUrl?: string;
      }
    | 'uploaded'
    | 'avatar'
    | 'none'
    | null,
  profilePictureValue?: string | null
): string {
  if (!userOrType) return NEUTRAL_DEFAULT_AVATAR_URL;

  let type: 'uploaded' | 'avatar' | 'none' | undefined;
  let picture: string | null | undefined;
  let fallbackUrl: string | undefined;

  if (typeof userOrType === 'string') {
    type = userOrType;
    picture = profilePictureValue;
  } else {
    type = userOrType.profilePictureType;
    picture = userOrType.profilePicture;
    fallbackUrl = userOrType.avatarUrl;
  }

  // 1. Uploaded photo
  if (type === 'uploaded' && picture) {
    return picture;
  }

  // 2. Selected 3D avatar
  if (type === 'avatar' && picture) {
    const matched = getAvatarById(picture);
    if (matched) return matched.url;
    // In case picture holds direct URL
    if (picture.startsWith('http') || picture.startsWith('data:') || picture.startsWith('/')) {
      return picture;
    }
  }

  // 3. None / Skipped -> Neutral default
  if (type === 'none') {
    return NEUTRAL_DEFAULT_AVATAR_URL;
  }

  // 4. Backward compatibility: check picture if set without type
  if (picture) {
    const matched = getAvatarById(picture);
    if (matched) return matched.url;
    return picture;
  }

  // 5. Check avatarUrl if already populated
  if (fallbackUrl && !fallbackUrl.includes('images.unsplash.com')) {
    return fallbackUrl;
  }

  // Default to neutral avatar
  return NEUTRAL_DEFAULT_AVATAR_URL;
}
