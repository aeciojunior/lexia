import { useState } from "react";
import { Link } from "react-router-dom";
import { LexPageHeader } from "@/components/lexia/LexPageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, BookOpen, FolderOpen, Tag, Search, Edit, History, Sparkles, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const Wiki = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [openArticle, setOpenArticle] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryName, setCategoryName] = useState("");
  const [search, setSearch] = useState("");
  const [viewArticle, setViewArticle] = useState<any>(null);

  const { data: categories } = useQuery({
    queryKey: ["wiki-categories", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_categories")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ["wiki-articles", activeOrgId, search],
    queryFn: async () => {
      let query = supabase
        .from("wiki_articles")
        .select("*, wiki_categories(name)")
        .eq("organization_id", activeOrgId!)
        .order("updated_at", { ascending: false });
      if (search) query = query.ilike("title", `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wiki_categories").insert({
        organization_id: activeOrgId!,
        name: categoryName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki-categories"] });
      setOpenCategory(false);
      setCategoryName("");
      toast({ title: "Categoria criada" });
    },
  });

  const createArticle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wiki_articles").insert({
        organization_id: activeOrgId!,
        title,
        content,
        category_id: categoryId || null,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
        created_by: user!.id,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "wiki_article_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "wiki_article",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki-articles"] });
      setOpenArticle(false);
      setTitle("");
      setContent("");
      setTags("");
      toast({ title: "Artigo criado com sucesso" });
    },
  });

  return (
    <div className="space-y-6">
      <LexPageHeader
        overline="Conhecimento"
        title="Wiki Jurídica"
        description="Base de conhecimento interno da organização"
        actions={
          <RoleGuard permissions={["MANAGE_WIKI"]}>
            <div className="flex gap-2">
              <Dialog open={openCategory} onOpenChange={setOpenCategory}>
                <DialogTrigger asChild>
                  <Button variant="outline"><FolderOpen className="h-4 w-4 mr-2" />Nova Categoria</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Criar Categoria</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Nome da categoria" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
                    <Button onClick={() => createCategory.mutate()} disabled={!categoryName}>Criar</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={openArticle} onOpenChange={setOpenArticle}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Novo Artigo</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Criar Artigo</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger><SelectValue placeholder="Categoria (opcional)" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea placeholder="Conteúdo do artigo..." className="min-h-[200px]" value={content} onChange={(e) => setContent(e.target.value)} />
                    <Input placeholder="Tags (separadas por vírgula)" value={tags} onChange={(e) => setTags(e.target.value)} />
                    <Button onClick={() => createArticle.mutate()} disabled={!title || !content}>Publicar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </RoleGuard>
        }
      />

      <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 border-primary/20 bg-primary/5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Design System LexIA v3</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tokens, componentes, navegação categorizada e favoritos. Documentação em{" "}
            <code className="text-primary">docs/DESIGN_SYSTEM.md</code>
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0 gap-2">
          <Link to="/design-system">
            Ver guia visual <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar artigos..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {viewArticle ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{viewArticle.title}</CardTitle>
                <div className="flex gap-2 mt-2">
                  {viewArticle.wiki_categories?.name && <Badge variant="outline"><FolderOpen className="h-3 w-3 mr-1" />{viewArticle.wiki_categories.name}</Badge>}
                  {viewArticle.tags?.map((tag: string) => <Badge key={tag} variant="secondary"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>)}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setViewArticle(null)}>Voltar</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">{viewArticle.content}</div>
            <p className="text-xs text-muted-foreground mt-6">
              v{viewArticle.version} — Atualizado em {format(new Date(viewArticle.updated_at), "dd/MM/yyyy HH:mm")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categories?.map((c: any) => (
              <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <ArticleGrid articles={articles} onView={setViewArticle} isLoading={isLoading} />
          </TabsContent>
          {categories?.map((c: any) => (
            <TabsContent key={c.id} value={c.id}>
              <ArticleGrid articles={articles?.filter((a: any) => a.category_id === c.id)} onView={setViewArticle} isLoading={false} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

const ArticleGrid = ({ articles, onView, isLoading }: { articles: any[]; onView: (a: any) => void; isLoading: boolean }) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {isLoading && <p className="text-muted-foreground">Carregando...</p>}
    {articles?.map((article: any) => (
      <Card key={article.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onView(article)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            {article.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">{article.content}</p>
          <div className="flex items-center gap-2 mt-3">
            {article.wiki_categories?.name && <Badge variant="outline" className="text-xs">{article.wiki_categories.name}</Badge>}
            <span className="text-xs text-muted-foreground ml-auto">v{article.version}</span>
          </div>
        </CardContent>
      </Card>
    ))}
    {!isLoading && (!articles || articles.length === 0) && (
      <p className="text-muted-foreground col-span-full text-center py-8">Nenhum artigo encontrado.</p>
    )}
  </div>
);

export default Wiki;
