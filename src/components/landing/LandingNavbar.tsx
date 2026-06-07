import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LexLogo } from "@/components/lexia/LexLogo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features", label: "Funcionalidades" },
  { href: "#security", label: "Segurança" },
  { href: "#pricing", label: "Preços" },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "py-2" : "py-3",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Ir para o conteúdo
      </a>

      <nav
        aria-label="Principal"
        className={cn(
          "container mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-4 sm:px-6 transition-all duration-300",
          scrolled
            ? "glass-strong shadow-lg border border-border/60"
            : "bg-transparent border border-transparent",
        )}
      >
        <Link to="/" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LexLogo size="sm" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-body-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button size="sm" className="shadow-glow-primary" asChild>
            <Link to="/auth">Criar conta</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100vw-2rem,320px)] border-border bg-background/95 backdrop-blur-xl">
            <SheetHeader>
              <SheetTitle className="text-left">
                <LexLogo size="sm" />
              </SheetTitle>
            </SheetHeader>
            <div className="mt-8 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-body-md font-medium text-foreground/90 transition-colors hover:bg-muted"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
              <Button variant="outline" asChild onClick={() => setOpen(false)}>
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/auth">Criar conta</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
