import { AudioUploader } from '@/components/AudioUploader';

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero Section */}
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-4">
          Process Your{' '}
          <span className="text-gradient">Therapy Sessions</span>
        </h1>
        <p className="text-lg text-surface-600 max-w-2xl mx-auto">
          Upload audio recordings of therapy sessions to automatically transcribe, 
          summarize, and enable semantic search across your sessions.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          {
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ),
            title: 'Speaker Detection',
            desc: 'Automatic speaker identification',
          },
          {
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            title: 'AI Summaries',
            desc: 'Clinical session summaries',
          },
          {
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            ),
            title: 'Semantic Search',
            desc: 'Find content by meaning',
          },
        ].map((feature, i) => (
          <div
            key={feature.title}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/50 border border-surface-200 animate-slide-up opacity-0"
            style={{ animationDelay: `${(i + 1) * 100}ms`, animationFillMode: 'forwards' }}
          >
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
              {feature.icon}
            </div>
            <div>
              <h3 className="font-medium text-surface-900">{feature.title}</h3>
              <p className="text-sm text-surface-500">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Uploader */}
      <div className="animate-slide-up opacity-0" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
        <AudioUploader />
      </div>

      {/* Processing Info */}
      <div className="mt-12 text-center animate-fade-in" style={{ animationDelay: '600ms' }}>
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
          Processing Pipeline
        </h2>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {['Upload', 'Transcribe', 'Summarize', 'Vectorize', 'Ready'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-white border border-surface-200 rounded-lg text-sm text-surface-600">
                {step}
              </span>
              {i < 4 && (
                <svg className="w-4 h-4 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
