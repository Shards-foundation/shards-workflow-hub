import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Workflows from "./pages/Workflows";
import WorkflowDetail from "./pages/WorkflowDetail";
import Connectors from "./pages/Connectors";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import Analytics from "./pages/Analytics";
import AIChat from "./pages/AIChat";
import Pricing from "./pages/Pricing";
import Subscription from "./pages/Subscription";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/workflows"} component={Workflows} />
      <Route path={"/workflows/:id"} component={WorkflowDetail} />
      <Route path={"/connectors"} component={Connectors} />
      <Route path={"/clients"} component={Clients} />
      <Route path={"/projects"} component={Projects} />
        <Route path="/analytics" component={Analytics} />
      <Route path="/ai-chat" component={AIChat} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/subscription" component={Subscription} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
