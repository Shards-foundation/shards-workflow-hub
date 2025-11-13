import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Sparkles, Zap, Crown } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const { data: plans, isLoading } = trpc.subscriptionPlans.list.useQuery();
  const createCheckout = trpc.subscription.createCheckout.useMutation();

  const handleSubscribe = async (planId: number, planName: string) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (planName === "free") {
      toast.info("You're already on the Free plan!");
      return;
    }

    try {
      toast.loading("Redirecting to checkout...");
      const result = await createCheckout.mutateAsync({ planId });
      
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        toast.success("Opening checkout page...");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create checkout session");
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case "free":
        return <Sparkles className="w-6 h-6" />;
      case "pro":
        return <Zap className="w-6 h-6" />;
      case "enterprise":
        return <Crown className="w-6 h-6" />;
      default:
        return null;
    }
  };

  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  const getFeaturesList = (features: any) => {
    if (!features) return [];
    
    return [
      `${features.aiModelsAccess?.[0] === "all" ? "All 13" : features.aiModelsAccess?.length || 0} AI Models`,
      `${features.maxWorkflows === "unlimited" ? "Unlimited" : features.maxWorkflows} Workflows`,
      `${features.maxExecutionsPerMonth === "unlimited" ? "Unlimited" : features.maxExecutionsPerMonth} Executions/month`,
      features.prioritySupport && "Priority Support",
      features.customIntegrations && "Custom Integrations",
      features.teamCollaboration && "Team Collaboration",
      features.apiAccess && "API Access",
    ].filter(Boolean);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-20 px-4">
      <div className="container max-w-6xl">
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="outline">
            Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start for free, upgrade as you grow. All plans include access to our powerful workflow automation platform.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans?.map((plan) => {
            const features = getFeaturesList(plan.features);
            const isPopular = plan.name === "pro";
            
            return (
              <Card
                key={plan.id}
                className={`relative ${
                  isPopular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <Badge className="bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      plan.name === "free" ? "bg-blue-500/10 text-blue-500" :
                      plan.name === "pro" ? "bg-purple-500/10 text-purple-500" :
                      "bg-amber-500/10 text-amber-500"
                    }`}>
                      {getPlanIcon(plan.name)}
                    </div>
                    <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        {formatPrice(plan.price)}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-muted-foreground">
                          /{plan.interval}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id, plan.name)}
                    disabled={createCheckout.isPending}
                  >
                    {createCheckout.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : plan.name === "free" ? (
                      "Get Started"
                    ) : (
                      "Subscribe Now"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>All plans include 14-day money-back guarantee</p>
          <p className="mt-2">Need a custom plan? <a href="mailto:support@shardslabs.com" className="text-primary hover:underline">Contact us</a></p>
        </div>
      </div>
    </div>
  );
}
