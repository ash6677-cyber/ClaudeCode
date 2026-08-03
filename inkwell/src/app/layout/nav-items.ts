import {
  BarChart3,
  BookMarked,
  BookOpen,
  Boxes,
  Feather,
  Image,
  LayoutList,
  Library,
  Users,
} from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/projects', label: 'Projects', icon: Library, projectScoped: false },
  { to: '/editor', label: 'Editor', icon: Feather, projectScoped: true },
  { to: '/read', label: 'Read', icon: BookMarked, projectScoped: true },
  { to: '/almanac', label: 'Almanac', icon: BookOpen, projectScoped: true },
  { to: '/cards', label: 'Cards', icon: Users, projectScoped: true },
  { to: '/planning', label: 'Planning', icon: LayoutList, projectScoped: true },
  { to: '/covers', label: 'Covers', icon: Image, projectScoped: true },
  { to: '/series', label: 'Series', icon: Boxes, projectScoped: false },
  { to: '/stats', label: 'Stats', icon: BarChart3, projectScoped: false },
] as const
