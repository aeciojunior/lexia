import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  findActiveGroupId,
  flattenNavItems,
  getVisibleNavGroups,
  type NavGroup,
  type NavItem,
} from "@/lib/navigation";
import { useNavFavorites } from "@/hooks/useNavFavorites";
import { useAuth } from "@/hooks/useAuth";
import { ChevronDown, Pin, PinOff, Search, Sparkles, Star, X } from "lucide-react";

interface SidebarNavProps {
  groups: NavGroup[];
  collapsed?: boolean;
  searchQuery?: string;
  onNavigate?: () => void;
}

function NavItemLink({
  item,
  collapsed,
  onNavigate,
  isPinned,
  onTogglePin,
  showPin = true,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
  isPinned?: boolean;
  onTogglePin?: (url: string) => void;
  showPin?: boolean;
}) {
  const link = (
    <NavLink
      to={item.url}
      end={item.url === "/dashboard"}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium",
        "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        collapsed && "justify-center px-2",
        isPinned && !collapsed && "border border-primary/15 bg-primary/5",
      )}
      activeClassName="bg-sidebar-accent text-sidebar-primary shadow-sm neon-border font-semibold"
    >
      <item.icon className={cn("h-4 w-4 shrink-0", item.accent && "text-secondary")} />
      {!collapsed && (
        <>
          <span className="truncate leading-snug flex-1">{item.title}</span>
          {item.accent && <Sparkles className="h-3 w-3 text-secondary shrink-0 opacity-80" />}
          {showPin && onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin(item.url);
              }}
              className={cn(
                "shrink-0 p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-sidebar-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
                isPinned && "opacity-100 text-primary",
              )}
              aria-label={isPinned ? "Remover dos favoritos" : "Fixar nos favoritos"}
              title={isPinned ? "Remover dos favoritos" : "Fixar nos favoritos"}
            >
              {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function SidebarNav({ groups, collapsed, searchQuery = "", onNavigate }: SidebarNavProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { favorites, isPinned, togglePin } = useNavFavorites(user?.id);
  const activeGroupId = findActiveGroupId(location.pathname, groups);
  const allItems = useMemo(() => flattenNavItems(groups), [groups]);

  const favoriteItems = useMemo(
    () =>
      favorites
        .map((url) => allItems.find((item) => item.url === url))
        .filter((item): item is NavItem => !!item),
    [favorites, allItems],
  );

  const [favoritesOpen, setFavoritesOpen] = useState(true);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groups) {
      initial[g.id] = g.defaultOpen ?? false;
    }
    return initial;
  });

  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => ({ ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.url.toLowerCase().includes(q) ||
            item.keywords?.some((k) => k.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const allOpen: Record<string, boolean> = {};
      for (const g of filteredGroups) allOpen[g.id] = true;
      setOpenGroups((prev) => ({ ...prev, ...allOpen }));
    }
  }, [searchQuery, filteredGroups]);

  if (filteredGroups.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        Nenhum menu encontrado
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {!collapsed && favoriteItems.length > 0 && !searchQuery.trim() && (
        <Collapsible open={favoritesOpen} onOpenChange={setFavoritesOpen} className="mb-2">
          <CollapsibleTrigger
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left",
              "text-[11px] font-semibold uppercase tracking-wider text-primary/90",
              "hover:bg-sidebar-accent/50 transition-colors",
            )}
          >
            <Star className="h-3.5 w-3.5 shrink-0 fill-primary/20 text-primary" />
            <span className="flex-1 truncate">Favoritos</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{favoriteItems.length}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", favoritesOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-0.5 space-y-0.5 pl-1">
            {favoriteItems.map((item) => (
              <NavItemLink
                key={`fav-${item.url}`}
                item={item}
                onNavigate={onNavigate}
                isPinned
                onTogglePin={togglePin}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {collapsed && favoriteItems.length > 0 && !searchQuery.trim() && (
        <div className="space-y-0.5 px-1 mb-2 pb-2 border-b border-sidebar-border/50">
          {favoriteItems.map((item) => (
            <NavItemLink key={`fav-c-${item.url}`} item={item} collapsed onNavigate={onNavigate} showPin={false} />
          ))}
        </div>
      )}

      {filteredGroups.map((group) => {
        const isSingle = group.items.length === 1 && group.id === "inicio";
        const isOpen = openGroups[group.id] ?? false;

        if (isSingle) {
          return (
            <div key={group.id} className="px-1">
              <NavItemLink
                item={group.items[0]}
                collapsed={collapsed}
                onNavigate={onNavigate}
                isPinned={isPinned(group.items[0].url)}
                onTogglePin={togglePin}
                showPin={!collapsed}
              />
            </div>
          );
        }

        if (collapsed) {
          return (
            <div key={group.id} className="space-y-0.5 px-1">
              {group.items.map((item) => (
                <NavItemLink key={item.url} item={item} collapsed onNavigate={onNavigate} showPin={false} />
              ))}
            </div>
          );
        }

        return (
          <Collapsible
            key={group.id}
            open={isOpen}
            onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.id]: open }))}
          >
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left",
                "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                activeGroupId === group.id && "text-sidebar-primary",
              )}
            >
              <group.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="flex-1 truncate">{group.label}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-normal", isOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-0.5 space-y-0.5 pl-1 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              {group.items.map((item) => (
                <NavItemLink
                  key={item.url}
                  item={item}
                  onNavigate={onNavigate}
                  isPinned={isPinned(item.url)}
                  onTogglePin={togglePin}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
  collapsed?: boolean;
}

export function SidebarSearch({ value, onChange, collapsed }: SidebarSearchProps) {
  if (collapsed) return null;

  return (
    <div className="relative px-3 pb-2">
      <Search className="absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar no menu..."
        className="h-9 pl-8 pr-8 text-xs bg-sidebar-accent/40 border-sidebar-border rounded-xl placeholder:text-muted-foreground/70"
        aria-label="Buscar no menu"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
          aria-label="Limpar busca"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export { getVisibleNavGroups };
