import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Boxes, Search, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Connectors() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: connectors, isLoading, refetch } = trpc.mcpConnectors.list.useQuery();
  const toggleConnector = trpc.mcpConnectors.toggle.useMutation({
    onSuccess: () => {
      toast.success("Connector status updated");
      refetch();
    }
  });

  const filteredConnectors = connectors?.filter((c) => {
    const matchesSearch = c.displayName.toLowerCase().includes(search.toLowerCase()) ||
                         c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = connectors
    ? Array.from(new Set(connectors.map((c) => c.category)))
    : [];

  const connectorsByCategory = filteredConnectors?.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {} as Record<string, typeof connectors>);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">MCP Connectors</h1>
          <p className="text-muted-foreground">
            Manage integrations across {connectors?.length || 0} platforms
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search connectors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {connectorsByCategory && Object.keys(connectorsByCategory).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(connectorsByCategory).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xl font-semibold mb-4 capitalize">
                  {category.replace(/_/g, ' ')}
                  <span className="text-muted-foreground text-sm ml-2">
                    ({items?.length || 0})
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items?.map((connector) => (
                    <Card key={connector.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              <Boxes className="h-5 w-5" />
                              {connector.displayName}
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {connector.description}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {connector.healthStatus === 'healthy' && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                            {connector.healthStatus === 'degraded' && (
                              <AlertCircle className="h-5 w-5 text-yellow-500" />
                            )}
                            {connector.healthStatus === 'down' && (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Status: </span>
                            <span className={connector.isActive ? "text-primary" : "text-muted-foreground"}>
                              {connector.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <Switch
                            checked={connector.isActive}
                            onCheckedChange={(checked) => {
                              toggleConnector.mutate({ id: connector.id, isActive: checked });
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Boxes className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No connectors found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Try adjusting your search or filter criteria
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
