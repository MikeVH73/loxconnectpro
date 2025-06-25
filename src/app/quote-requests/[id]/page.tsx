"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, Firestore } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAuth } from "../../AuthProvider";
import { useCustomers } from "../../hooks/useCustomers";
import { useMessages } from "../../hooks/useMessages";
import MessagingPanel from "../../components/MessagingPanel";

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  customer: string;
  customerNumber?: string;
  status: string;
  products: any[];
  jobsite: {
    address: string;
    coordinates: any;
  };
  startDate: string;
  endDate: string | null;
  customerDecidesEnd: boolean;
  jobsiteContactId: string;
  jobsiteContact: any;
  labels: string[];
  notes: any[];
  attachments: any[];
  createdAt: any;
  updatedAt: any;
  waitingForAnswer?: boolean;
  urgent?: boolean;
  problems?: boolean;
  targetCountry?: string;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  email?: string;
  customerNumbers?: { [country: string]: string };
}

export default function QuoteRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);
  const [error, setError] = useState("");
  const { customers } = useCustomers();
  const { messages, loading: messagesLoading, error: messagesError, sendMessage } = useMessages(params.id as string);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!db) {
        setError("Database not initialized");
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db as Firestore, "quoteRequests", params.id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const formattedData: QuoteRequest = {
            id: snap.id,
            title: data.title || "",
            creatorCountry: data.creatorCountry || "",
            involvedCountry: data.involvedCountry || "",
            customer: data.customer || "",
            customerNumber: data.customerNumber || "",
            status: data.status || "",
            products: data.products || [],
            jobsite: {
              address: data.jobsite?.address || data.jobsiteAddress || "",
              coordinates: data.jobsite?.coordinates || null
            },
            startDate: data.startDate || "",
            endDate: data.endDate || null,
            customerDecidesEnd: data.customerDecidesEnd || false,
            jobsiteContactId: data.jobsiteContactId || "",
            jobsiteContact: data.jobsiteContact || null,
            labels: data.labels || [],
            notes: data.notes || [],
            attachments: data.attachments || [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            waitingForAnswer: data.waitingForAnswer || false,
            urgent: data.urgent || false,
            problems: data.problems || false,
            targetCountry: data.targetCountry || ""
          };
          setQuoteRequest(formattedData);
        } else {
          setError("Quote Request not found");
        }
      } catch (err) {
        console.error("Error fetching quote request:", err);
        setError("Failed to load quote request");
      }
      setLoading(false);
    };

    fetchData();
  }, [params.id]);

  const handleSendMessage = async (text: string) => {
    if (!user?.email || !userProfile?.businessUnit) {
      throw new Error('Cannot send message: User not authenticated');
    }
    await sendMessage(text, user.email, userProfile.businessUnit);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  if (!quoteRequest) {
    return <div className="min-h-screen flex items-center justify-center">Quote Request not found</div>;
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Link href="/quote-requests" className="text-gray-400 hover:text-gray-600">
                  Quote Request
                </Link>
                <span className="text-gray-400">/</span>
                {quoteRequest.creatorCountry}
                {quoteRequest.involvedCountry && (
                  <>
                    <span className="text-gray-400">→</span>
                    {quoteRequest.involvedCountry}
                  </>
                )}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/quote-requests")}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Back to List
            </button>
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-wrap gap-4 items-center mb-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={quoteRequest.waitingForAnswer}
                  disabled
                  className="h-5 w-5 text-blue-600"
                />
                <label className="text-sm text-gray-700">
                  Waiting for Answer
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={quoteRequest.urgent}
                  disabled
                  className="h-5 w-5 text-red-600"
                />
                <label className="text-sm text-gray-700">
                  Urgent
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={quoteRequest.problems}
                  disabled
                  className="h-5 w-5 text-yellow-600"
                />
                <label className="text-sm text-gray-700">
                  Problems
                </label>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_2fr_1fr] gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <label className="block mb-1 font-medium">Title</label>
                  <input
                    type="text"
                    value={quoteRequest.title}
                    disabled
                    className="w-full p-2 border rounded bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Creator Country</label>
                  <input
                    type="text"
                    value={quoteRequest.creatorCountry}
                    disabled
                    className="w-full p-2 border rounded bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Target Country</label>
                  <input
                    type="text"
                    value={quoteRequest.involvedCountry || quoteRequest.targetCountry || ""}
                    disabled
                    className="w-full p-2 border rounded bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Customer</label>
                  <input
                    type="text"
                    value={customers.find(c => c.id === quoteRequest.customer)?.name || ""}
                    disabled
                    className="w-full p-2 border rounded bg-gray-50"
                  />
                </div>
                {quoteRequest.customerNumber && (
                  <div>
                    <label className="block mb-1 font-medium">
                      Customer Number for {quoteRequest.involvedCountry}
                    </label>
                    <input
                      type="text"
                      value={quoteRequest.customerNumber}
                      disabled
                      className="w-full p-2 border rounded bg-gray-50"
                    />
                  </div>
                )}
                <div>
                  <label className="block mb-1 font-medium">Status</label>
                  <input
                    type="text"
                    value={quoteRequest.status}
                    disabled
                    className="w-full p-2 border rounded bg-gray-50"
                  />
                </div>
              </div>

              {/* Middle Column */}
              <div className="space-y-6">
                <div>
                  <label className="block mb-1 font-medium">Products</label>
                  {quoteRequest.products?.map((product: any, idx: number) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={product.catClass || ""}
                        disabled
                        placeholder="Cat. Class"
                        className="w-[150px] p-2 border rounded bg-gray-50"
                      />
                      <input
                        type="text"
                        value={product.description || ""}
                        disabled
                        placeholder="Description"
                        className="flex-1 p-2 border rounded bg-gray-50"
                      />
                      <input
                        type="number"
                        value={product.quantity || ""}
                        disabled
                        placeholder="Qty"
                        className="w-20 p-2 border rounded bg-gray-50"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block mb-1 font-medium">Notes</label>
                  <div className="space-y-2">
                    {quoteRequest.notes?.map((note: any, index: number) => (
                      <div key={`note-${index}-${note.dateTime}`} className="text-sm bg-gray-50 p-2 rounded">
                        <div className="text-gray-500">
                          {note.user} on {new Date(note.dateTime).toLocaleString()}
                        </div>
                        {note.text}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block mb-1 font-medium">Attachments</label>
                  <div className="space-y-2">
                    {quoteRequest.attachments?.map((attachment: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {attachment.name}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 font-medium">Start Date</label>
                    <input
                      type="date"
                      value={quoteRequest.startDate}
                      disabled
                      className="w-full p-2 border rounded bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">End Date</label>
                    <div>
                      <input
                        type="date"
                        value={quoteRequest.endDate || ""}
                        disabled
                        className="w-full p-2 border rounded bg-gray-50"
                      />
                      {quoteRequest.customerDecidesEnd && (
                        <div className="mt-1 text-sm text-gray-600">
                          Customer decides end date
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 font-medium">Jobsite Address</label>
                  <input
                    type="text"
                    value={quoteRequest.jobsite.address}
                    disabled
                    className="w-full p-2 border rounded bg-gray-50"
                  />
                </div>

                {quoteRequest.jobsite.coordinates && (
                  <div>
                    <label className="block mb-1 font-medium">Coordinates</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="text"
                          value={quoteRequest.jobsite.coordinates.lat || ""}
                          disabled
                          className="w-full p-2 border rounded bg-gray-50"
                          placeholder="Latitude"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={quoteRequest.jobsite.coordinates.lng || ""}
                          disabled
                          className="w-full p-2 border rounded bg-gray-50"
                          placeholder="Longitude"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block mb-1 font-medium">Jobsite Contact</label>
                  <input
                    type="text"
                    value={quoteRequest.jobsiteContact ? `${quoteRequest.jobsiteContact.name} (${quoteRequest.jobsiteContact.phone})` : ""}
                    disabled
                    className="w-full p-2 border rounded bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messaging panel */}
      <div className="w-[400px] border-l border-gray-200 bg-white">
        <MessagingPanel
          quoteRequestId={params.id as string}
          messages={messages}
          onSendMessage={handleSendMessage}
          loading={messagesLoading}
          error={messagesError}
        />
      </div>
    </div>
  );
} 