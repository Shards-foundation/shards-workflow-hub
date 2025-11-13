import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, CreditCard, Calendar, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Subscription() {
  const { user, isAuthenticated } = useAuth();
  const { data, isLoading } = trpc.subscription.current.useQuery();
  const { data: paymentHistory } = trpc.payments.history.useQuery();
  const createPortal = trpc.subscription.createPortalSession.useMutation();

  const handleManageSubscription = async () => {
    try {
      toast.loading("Opening customer portal...");
      const result = await createPortal.mutateAsync();
      
      if (result.portalUrl) {
        window.open(result.portalUrl, "_blank");
        toast.success("Opening Stripe Customer Portal...");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to open customer portal");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to view your subscription</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { plan, subscription } = data || {};
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing information
          </p>
        </div>

        <div className="grid gap-6">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-bold">{plan?.displayName}</h3>
                      {subscription?.status && (
                        <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                          {subscription.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{plan?.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {formatPrice(plan?.price || 0)}
                    </div>
                    {plan && plan.price > 0 && (
                      <div className="text-sm text-muted-foreground">
                        per {plan.interval}
                      </div>
                    )}
                  </div>
                </div>

                {subscription && (
                  <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Current Period Start
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDate(subscription.currentPeriodStart)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Current Period End
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDate(subscription.currentPeriodEnd)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  {subscription && subscription.stripeCustomerId ? (
                    <Button
                      onClick={handleManageSubscription}
                      disabled={createPortal.isPending}
                    >
                      {createPortal.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Manage Subscription"
                      )}
                    </Button>
                  ) : (
                    <Link href="/pricing">
                      <Button>Upgrade Plan</Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                Your recent transactions and invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentHistory && paymentHistory.length > 0 ? (
                <div className="space-y-3">
                  {paymentHistory.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <div className="font-medium">{payment.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(payment.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {formatPrice(payment.amount)}
                        </div>
                        <Badge variant={payment.status === "succeeded" ? "default" : "secondary"}>
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No payment history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
