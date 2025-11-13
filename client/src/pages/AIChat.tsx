import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Bot, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function AIChat() {
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  
  const { data: models = [] } = trpc.aiModels.list.useQuery();
  const { data: conversations = [] } = trpc.aiConversations.list.useQuery();
  const { data: messages = [] } = trpc.aiMessages.list.useQuery(
    { conversationId: selectedConversation! },
    { enabled: !!selectedConversation }
  );
  
  const createConversation = trpc.aiConversations.create.useMutation({
    onSuccess: (data) => {
      setSelectedConversation(data.id);
      toast.success("New conversation created");
      trpc.useUtils().aiConversations.list.invalidate();
    },
  });
  
  const deleteConversation = trpc.aiConversations.delete.useMutation({
    onSuccess: () => {
      setSelectedConversation(null);
      toast.success("Conversation deleted");
      trpc.useUtils().aiConversations.list.invalidate();
    },
  });
  
  const sendMessage = trpc.aiMessages.send.useMutation({
    onSuccess: () => {
      setMessage("");
      trpc.useUtils().aiMessages.list.invalidate();
      trpc.useUtils().aiConversations.list.invalidate();
    },
  });
  
  const handleNewConversation = () => {
    if (!selectedModel) {
      toast.error("Please select an AI model first");
      return;
    }
    createConversation.mutate({
      modelId: selectedModel,
      title: `New conversation with ${models.find(m => m.id === selectedModel)?.displayName}`,
    });
  };
  
  const handleSendMessage = () => {
    if (!selectedConversation || !message.trim()) return;
    sendMessage.mutate({
      conversationId: selectedConversation,
      content: message,
    });
  };
  
  const chatModels = models.filter(m => m.category === "chat");
  
  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className="w-80 border-r border-border bg-card/50 flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold mb-4">AI Chat</h2>
            
            <Select value={selectedModel?.toString()} onValueChange={(v) => setSelectedModel(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI Model" />
              </SelectTrigger>
              <SelectContent>
                {chatModels.map((model) => (
                  <SelectItem key={model.id} value={model.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      {model.displayName}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleNewConversation}
              className="w-full mt-3"
              disabled={!selectedModel || createConversation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Conversation
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 px-4">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Select a model and start chatting</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => {
                  const model = models.find(m => m.id === conv.modelId);
                  return (
                    <Card
                      key={conv.id}
                      className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                        selectedConversation === conv.id ? "bg-accent" : ""
                      }`}
                      onClick={() => setSelectedConversation(conv.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">
                              {model?.displayName}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">
                            {conv.title || "Untitled conversation"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {conv.messageCount} messages
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation.mutate({ id: conv.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <Card
                      className={`max-w-[80%] p-4 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {msg.role === "assistant" && (
                          <Bot className="h-5 w-5 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
                {sendMessage.isPending && (
                  <div className="flex justify-start">
                    <Card className="max-w-[80%] p-4 bg-card">
                      <div className="flex items-center gap-3">
                        <Bot className="h-5 w-5 animate-pulse" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
              
              <div className="border-t border-border p-4">
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={sendMessage.isPending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sendMessage.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
                <p className="text-sm">Select a conversation or create a new one to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
