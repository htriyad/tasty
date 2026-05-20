import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDecodeToFolder, useListFolders, getListQuestionSetsQueryKey, getGetFolderStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Import as ImportIcon, FolderIcon, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const formSchema = z.object({
  folderId: z.string().min(1, "Please select a destination folder"),
  input: z.string().min(1, "Chorcha ID or URL is required"),
  token: z.string().min(1, "Session token is required"),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ImportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: folders, isLoading: foldersLoading } = useListFolders({ flat: true });
  const decodeMutation = useDecodeToFolder();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      folderId: "",
      input: "",
      token: "",
      name: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    const folderId = parseInt(values.folderId, 10);
    if (isNaN(folderId)) return;

    decodeMutation.mutate(
      {
        data: {
          folderId,
          input: values.input,
          token: values.token,
          name: values.name || undefined,
        },
      },
      {
        onSuccess: (data) => {
          toast({
            title: "Import Successful",
            description: "Question set has been imported successfully.",
          });
          queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
          queryClient.invalidateQueries({ queryKey: getGetFolderStatsQueryKey() });
          
          // Reset form or navigate
          form.reset();
          setLocation(`/folders/${folderId}`);
        },
        onError: (error) => {
          toast({
            title: "Import Failed",
            description: error?.error || "An error occurred during import.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Questions</h1>
        <p className="text-muted-foreground mt-1">Import question sets directly from Chorcha</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImportIcon className="h-5 w-5 text-primary" />
            Chorcha Import
          </CardTitle>
          <CardDescription>
            Provide the Chorcha read URL or ID, along with a valid session token, to decode and import a question set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="folderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Folder</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={foldersLoading ? "Loading folders..." : "Select a folder"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {folders?.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id.toString()}>
                            <div className="flex items-center gap-2">
                              <FolderIcon className="h-4 w-4 text-muted-foreground" />
                              <span>{folder.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The folder where this question set will be saved.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="input"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chorcha Input</FormLabel>
                    <FormControl>
                      <Input placeholder="Read URL or ID (e.g., https://chorcha.net/read/...)" {...field} />
                    </FormControl>
                    <FormDescription>
                      The URL to the question set in Chorcha, or just its ID.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Token</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Paste session token here" {...field} />
                    </FormControl>
                    <FormDescription>
                      A valid Chorcha session token is required to decrypt the payload.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Set Name Override (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Leave blank to use Chorcha's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={decodeMutation.isPending}>
                  {decodeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Start Import"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
