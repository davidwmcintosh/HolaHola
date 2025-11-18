import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserCircle, Trash2, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { userName, language } = useLanguage();
  const [isResetting, setIsResetting] = useState(false);

  const handleResetProfile = () => {
    setIsResetting(true);
    // Clear all localStorage data
    localStorage.clear();
    // Reload the page to reset the app state
    window.location.href = "/";
  };

  const languageNames: Record<string, string> = {
    spanish: "Spanish",
    french: "French",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    japanese: "Japanese",
    mandarin: "Mandarin Chinese",
    korean: "Korean"
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>

        {/* Profile Information */}
        <Card data-testid="card-profile-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Your current profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-lg" data-testid="text-profile-name">{userName || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Learning Language</p>
                <div className="flex items-center gap-2 mt-1">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" data-testid="badge-learning-language">
                    {languageNames[language] || language}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reset Profile */}
        <Card data-testid="card-reset-profile">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Reset Profile
            </CardTitle>
            <CardDescription>
              Clear all your profile data and start fresh
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This will clear your name, language preference, and all saved conversations. 
              Your vocabulary and progress data will remain unchanged.
            </p>
          </CardContent>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={isResetting}
                  data-testid="button-reset-profile"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isResetting ? "Resetting..." : "Reset Profile"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear your profile information (name and language preference) 
                    and you'll go through the onboarding process again. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetProfile}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-reset"
                  >
                    Reset Profile
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
