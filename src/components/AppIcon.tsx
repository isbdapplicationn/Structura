import {
  BookOpen,
  Boxes,
  CalendarCheck,
  ClipboardList,
  Contact,
  Database,
  FileText,
  GraduationCap,
  Layers,
  Library,
  MessageSquarePlus,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  GraduationCap,
  BookOpen,
  FileText,
  Users,
  UserCheck,
  Boxes,
  Package,
  Receipt,
  TrendingUp,
  CalendarCheck,
  Library,
  ClipboardList,
  MessageSquarePlus,
  ShoppingBag,
  Contact,
  Database,
  Layers,
};

export function AppIcon({
  name,
  className = 'w-5 h-5',
  style,
}: {
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const IconComp = (name && ICON_MAP[name]) || Database;
  return <IconComp className={className} style={style} />;
}

export const AVAILABLE_APP_ICONS = Object.keys(ICON_MAP);
