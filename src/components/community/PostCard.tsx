import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/utils";

export type PostCardData = {
  id: string;
  title: string | null;
  content: string;
  pinned: boolean;
  createdAt: Date;
  spaceName: string;
  spaceSlug: string;
  authorName: string;
  authorImage: string | null;
  commentCount: number;
};

export function PostCard({ post, showSpace = true }: { post: PostCardData; showSpace?: boolean }) {
  return (
    <Link
      href={`/community/${post.spaceSlug}/${post.id}`}
      className={`block rounded-xl border bg-card p-4 transition-colors hover:border-input ${
        post.pinned ? "border-brand/40 bg-brand/5" : "border-border"
      }`}
    >
      <div className="mb-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Avatar src={post.authorImage} name={post.authorName} size={28} />
        <span className="min-w-0 truncate font-medium text-foreground">{post.authorName}</span>
        {showSpace && (
          <span className="shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {post.spaceName}
          </span>
        )}
        <span className="shrink-0 text-muted-foreground">·</span>
        <time className="shrink-0 text-muted-foreground">{timeAgo(post.createdAt)}</time>
        {post.pinned && <span className="ml-auto shrink-0 text-brand">📌</span>}
      </div>
      {post.title && <h3 className="font-semibold text-foreground break-words">{post.title}</h3>}
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-foreground">
        {post.content}
      </p>
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <MessageSquare className="size-3.5" /> {post.commentCount}
      </div>
    </Link>
  );
}
