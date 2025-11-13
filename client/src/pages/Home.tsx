import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { 
  Workflow, 
  Zap, 
  BarChart3, 
  Users, 
  Boxes, 
  ArrowRight,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    window.location.href = "/dashboard";
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="Shards Labs" className="h-10 w-10" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                {APP_TITLE}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a href={getLoginUrl()} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </a>
              <Button asChild>
                <a href={getLoginUrl()}>Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-background"></div>
        <div className="container relative mx-auto px-6 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>Powered by 30+ MCP Connectors</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              Autonomous Business Operations at Scale
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Orchestrate complex workflows across 30+ platforms. Automate client acquisition, project management, content generation, and revenue operations—all from one unified dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="text-lg px-8">
                <a href={getLoginUrl()}>
                  Start Building <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg px-8">
                <a href="#features">Explore Features</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "MCP Connectors", value: "30+" },
              { label: "Workflow Templates", value: "50+" },
              { label: "Automation Rate", value: "80%" },
              { label: "Time Saved", value: "40hrs/wk" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Automate</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive workflow orchestration across every aspect of your business operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Workflow,
                title: "Workflow Orchestration",
                description: "Design, deploy, and monitor complex multi-step workflows with visual builders and real-time execution tracking.",
                features: ["Visual workflow builder", "Real-time monitoring", "Error handling & retries"]
              },
              {
                icon: Users,
                title: "Client Acquisition",
                description: "Automate prospect discovery, outreach, and onboarding with intelligent lead scoring and personalized campaigns.",
                features: ["Automated outreach", "Lead enrichment", "Smart scheduling"]
              },
              {
                icon: Boxes,
                title: "Project Management",
                description: "Sync tasks across Linear, Asana, ClickUp, and Notion with bi-directional updates and unified dashboards.",
                features: ["Multi-platform sync", "Task automation", "Progress tracking"]
              },
              {
                icon: Sparkles,
                title: "Content Generation",
                description: "Create marketing assets with Canva, InVideo, and AI-powered voice synthesis for scalable content production.",
                features: ["Design automation", "Video production", "AI voice synthesis"]
              },
              {
                icon: Zap,
                title: "Development Operations",
                description: "Streamline deployments with Vercel, manage databases with Supabase, and monitor errors with Sentry integration.",
                features: ["CI/CD automation", "Database management", "Error monitoring"]
              },
              {
                icon: BarChart3,
                title: "Analytics & Insights",
                description: "Track workflow performance, revenue metrics, and business intelligence with comprehensive dashboards.",
                features: ["Real-time analytics", "Custom reports", "Revenue tracking"]
              },
            ].map((feature) => (
              <Card key={feature.title} className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.features.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* MCP Connectors Section */}
      <section className="py-24 bg-card/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">30+ MCP Connectors</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Pre-integrated with the tools you already use
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              "Linear", "Asana", "ClickUp", "Notion", "Todoist", "Gmail",
              "Google Calendar", "Jotform", "Typeform", "Canva", "InVideo", "MiniMax",
              "Vercel", "Supabase", "Neon", "Cloudflare", "Sentry", "PostHog",
              "Stripe", "PayPal", "RevenueCat", "Explorium", "Hugging Face", "Zapier",
              "Dify", "Playwright", "Fireflies", "Jam", "Airtable", "Webflow"
            ].map((connector) => (
              <div
                key={connector}
                className="p-4 rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm text-center text-sm font-medium hover:border-primary/50 transition-colors"
              >
                {connector}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary/10 via-purple-500/5 to-background rounded-2xl p-12 border border-primary/20">
            <h2 className="text-4xl font-bold mb-4">Ready to Automate Your Business?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join Shards Labs and start building autonomous workflows today
            </p>
            <Button size="lg" asChild className="text-lg px-8">
              <a href={getLoginUrl()}>
                Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="Shards Labs" className="h-8 w-8" />
              <span className="font-semibold">Shards Labs Workflow Hub</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 Shards Inc Ltd. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
