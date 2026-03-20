import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, AlertTriangle, ImageIcon, FileText } from "lucide-react";

interface PostItem {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  notes: string;
  approval_status: string;
  rejection_reason: string;
  uploaded_at: string;
}

export default function ClientApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Validate token
      const { data: tokenData, error: tokenErr } = await (supabase as any)
        .from('approval_tokens')
        .select('*')
        .eq('token', token)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (tokenErr || !tokenData) {
        setError("Link inválido ou expirado. Solicite um novo link à equipe.");
        setLoading(false);
        return;
      }

      setClientName(tokenData.client_name);

      // Load posts for this client
      const { data: postsData } = await (supabase as any)
        .from('client_posts')
        .select('*')
        .eq('client_id', tokenData.client_id)
        .order('uploaded_at', { ascending: true });

      setPosts(postsData || []);
    } catch (e) {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (postId: string) => {
    setSubmitting(postId);
    await (supabase as any).from('client_posts').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      rejection_reason: '',
    }).eq('id', postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, approval_status: 'approved' } : p));
    setSubmitting(null);
    checkAllDone();
  };

  const handleReject = async (postId: string) => {
    const reason = rejectionReasons[postId];
    if (!reason?.trim()) {
      alert("Por favor, descreva o motivo da alteração solicitada.");
      return;
    }
    setSubmitting(postId);
    await (supabase as any).from('client_posts').update({
      approval_status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    }).eq('id', postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, approval_status: 'rejected', rejection_reason: reason } : p));
    setSubmitting(null);
    checkAllDone();
  };

  const checkAllDone = () => {
    const pending = posts.filter(p => p.approval_status === 'pending').length;
    if (pending <= 1) setAllDone(true); // current one being processed
  };

  useEffect(() => {
    if (posts.length > 0 && posts.every(p => p.approval_status !== 'pending')) {
      setAllDone(true);
    }
  }, [posts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Inválido</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">JG</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Aprovação de Posts</h1>
              <p className="text-sm text-gray-500">{clientName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            📋 Revise cada post abaixo. Clique em <strong>"Aprovar"</strong> para confirmar ou em <strong>"Solicitar Alteração"</strong> caso queira mudanças.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{posts.filter(p => p.approval_status === 'approved').length}</p>
            <p className="text-xs text-gray-500">Aprovados</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{posts.filter(p => p.approval_status === 'pending').length}</p>
            <p className="text-xs text-gray-500">Pendentes</p>
          </div>
        </div>

        {allDone && posts.every(p => p.approval_status !== 'pending') && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-green-800">Tudo revisado!</h2>
            <p className="text-sm text-green-600 mt-1">Obrigado pela revisão. A equipe já foi notificada.</p>
          </div>
        )}

        {/* Posts Grid */}
        <div className="space-y-4">
          {posts.map((post, idx) => (
            <div key={post.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${
              post.approval_status === 'approved' ? 'border-green-300 bg-green-50/30' :
              post.approval_status === 'rejected' ? 'border-red-300 bg-red-50/30' : ''
            }`}>
              {/* Post Image/Preview */}
              <div className="relative">
                {post.file_type === 'image' ? (
                  <img src={post.file_url} alt={post.file_name} className="w-full max-h-[400px] object-contain bg-gray-100" />
                ) : post.file_type === 'video' ? (
                  <video src={post.file_url} controls className="w-full max-h-[400px] bg-gray-900" />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center bg-gray-100">
                    <FileText className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                  Post {idx + 1} de {posts.length}
                </span>
                {post.approval_status !== 'pending' && (
                  <span className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-medium ${
                    post.approval_status === 'approved' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {post.approval_status === 'approved' ? '✓ Aprovado' : '✗ Alteração Solicitada'}
                  </span>
                )}
              </div>

              {/* Post Info & Actions */}
              <div className="p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">{post.file_name}</p>
                {post.notes && <p className="text-xs text-gray-500 mb-3">{post.notes}</p>}

                {post.approval_status === 'pending' && (
                  <div className="space-y-3">
                    {/* Rejection reason input */}
                    <div>
                      <textarea
                        value={rejectionReasons[post.id] || ''}
                        onChange={(e) => setRejectionReasons(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Caso queira alterações, descreva aqui o que deseja mudar..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[60px] resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(post.id)}
                        disabled={submitting === post.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {submitting === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleReject(post.id)}
                        disabled={submitting === post.id || !rejectionReasons[post.id]?.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        {submitting === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Solicitar Alteração
                      </button>
                    </div>
                  </div>
                )}

                {post.approval_status === 'rejected' && post.rejection_reason && (
                  <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs font-medium text-red-800 mb-1">Alteração solicitada:</p>
                    <p className="text-xs text-red-700">{post.rejection_reason}</p>
                  </div>
                )}

                {post.approval_status === 'approved' && (
                  <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Post aprovado com sucesso!
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="text-lg font-medium text-gray-900">Nenhum post para revisar</h2>
            <p className="text-sm text-gray-500 mt-1">Ainda não há posts aguardando aprovação.</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 pb-8">
          <p>JG · Gestão & Tráfego Pago</p>
        </div>
      </div>
    </div>
  );
}
