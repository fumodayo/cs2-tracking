import { PostAnalyzer } from "@/components/post-analyzer";

export default function PostAnalysisPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <p className="text-sm font-semibold tracking-[0.18em] text-blue-300 uppercase">
          Post Analyzer
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-50">
          Phân tích bài viết
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
          Dán bài rao bán case/terminal hoặc upload ảnh inventory để tính giá
          theo rate. Những bài đã phân tích sẽ được lưu lại trên trình duyệt
          này.
        </p>
      </div>

      <PostAnalyzer />
    </main>
  );
}
