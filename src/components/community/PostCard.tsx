import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export type PostCardData = {
  id: string;
  title: string | null;
  content: string;
  pinned: boolean;
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
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
        <Avatar src={post.authorImage} name={post.authorName} size={28} />
        <span className="font-medium text-neutral-700">{post.authorName}</span>
        {showSpace && (
          <>
            <span className="text-neutral-300">·</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-500">{post.spaceName}</span>
          </>
        )}
        {post.pinned && <span className="ml-auto text-neutral-400">📌</span>}
      </div>
      {post.title && <h3 className="font-semibold text-neutral-900">{post.title}</h3>}
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-neutral-700">{post.content}</p>
      <div className="mt-3 flex items-center gap-1 text-xs text-neutral-400">
        <MessageSquare className="size-3.5" /> {post.commentCount}
      </div>
    </Link>
  );
}
