import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';

const AnimatedImage = Reanimated.createAnimatedComponent(ExpoImage);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';

const SUBJECTS = ['Physics', 'Chemistry', 'Elective Maths', 'Core Maths', 'Integrated Science', 'Elective ICT', 'Social Studies', 'English'];

type Channel = {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_username: string | null;
  channel_photo_url: string | null;
  is_active: boolean;
  message_count: number;
};

type TgMessage = {
  id: string;
  channel_id: string;
  telegram_message_id: number;
  message_text: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  sent_at: string | null;
  saved_to_subject: string | null;
};

type CasioTelegramProps = {
  onClose: () => void;
};

type TelegramImageProps = {
  uri: string;
  isGrid: boolean;
  onOpen: () => void;
};

const TelegramImage = ({ uri, isGrid, onOpen }: TelegramImageProps) => {
  const [failed, setFailed] = useState(false);

  return (
    <Pressable
      onPress={onOpen}
      style={isGrid ? styles.msgImageGridItem : styles.msgImageSingle}
      disabled={failed}
    >
      {failed ? (
        <View style={isGrid ? styles.msgImagePlaceholderGrid : styles.msgImagePlaceholderFull}>
          <Ionicons name="image-outline" size={18} color="rgba(0,51,153,0.45)" />
          <Text style={styles.msgImagePlaceholderText}>IMAGE UNAVAILABLE</Text>
        </View>
      ) : (
        <ExpoImage
          source={{ uri }}
          style={isGrid ? styles.msgImageThumb : styles.msgImageFull}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      )}
    </Pressable>
  );
};

async function callEdgeFunction(name: string, body?: Record<string, unknown>, method = 'POST') {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

export const CasioTelegram = ({ onClose }: CasioTelegramProps) => {
  const [view, setView] = useState<'channels' | 'feed' | 'select_subject'>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('telegram_channels')
        .select('*')
        .order('created_at', { ascending: false });
      setChannels(data || []);
    } catch (e) {
      console.error('Load channels error:', e);
    }
    setIsLoading(false);
  };

  const loadMessages = async (channel: Channel) => {
    setSelectedChannel(channel);
    setView('feed');
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('telegram_messages')
        .select('*')
        .eq('channel_id', channel.channel_id)
        .order('sent_at', { ascending: false })
        .limit(50);
      setMessages(data || []);
    } catch (e) {
      console.error('Load messages error:', e);
    }
    setIsLoading(false);
  };

  const triggerPoll = async () => {
    setIsPolling(true);
    try {
      await callEdgeFunction('telegram-poll', {}, 'POST');
      // Reload messages if viewing a channel
      if (selectedChannel) {
        await loadMessages(selectedChannel);
      }
      await loadChannels();
    } catch (e) {
      console.error('Poll error:', e);
    }
    setIsPolling(false);
  };



  const handleSaveToSubject = async (subject: string) => {
    if (!savingMessageId) return;
    setSavingSubject(subject);
    try {
      await callEdgeFunction('telegram-save', {
        message_id: savingMessageId,
        subject,
      });
      // Update local state
      setMessages(prev =>
        prev.map(m => m.id === savingMessageId ? { ...m, saved_to_subject: subject } : m)
      );
    } catch (e) {
      console.error('Save error:', e);
    }
    setSavingSubject(null);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const h = hours.toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate();
    const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
    return `${h}:${m} ${ampm} ${day} ${mon}`;
  };

  // ─── Zoom Gesture Handlers ───
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = useCallback(() => {
    'worklet';
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: Math.max(0.5, scale.value) }
    ],
  }));

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      resetZoom();
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture, doubleTap);

  // ─── Expanded Image Overlay ───
  if (expandedImage) {
    return (
      <View style={styles.expandedOverlay}>
        <GestureDetector gesture={composed}>
          <Reanimated.View style={StyleSheet.absoluteFill}>
            <AnimatedImage 
              source={{ uri: expandedImage }} 
              style={[StyleSheet.absoluteFill, animatedStyle]} 
              contentFit="contain" 
            />
          </Reanimated.View>
        </GestureDetector>
        <Pressable style={styles.expandedClose} onPress={() => { resetZoom(); setExpandedImage(null); }}>
          <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>
    );
  }

  // ─── Select Subject View ───
  if (view === 'select_subject') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => { setView('feed'); setSavingMessageId(null); }}>
            <Ionicons name="chevron-back" size={16} color="#003399" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            SELECT SUBJECT TO SAVE
          </Text>
          <View style={{ width: 16 }} />
        </View>
        <ScrollView contentContainerStyle={styles.channelList} showsVerticalScrollIndicator={false}>
          {SUBJECTS.map((sub) => {
            const currentMsg = messages.find(m => m.id === savingMessageId);
            const isThisSaved = currentMsg?.saved_to_subject === sub;

            return (
            <Pressable
              key={sub}
              style={styles.channelRow}
              onPress={() => handleSaveToSubject(sub)}
              disabled={savingSubject !== null}
            >
              <View style={styles.channelInfo}>
                <Text style={styles.channelName}>{sub.toUpperCase()}</Text>
              </View>
              {savingSubject === sub ? (
                <ActivityIndicator size="small" color="#003399" />
              ) : isThisSaved ? (
                <Ionicons name="checkmark-circle" size={16} color="#003399" />
              ) : (
                <Ionicons name="chevron-forward" size={14} color="rgba(0,51,153,0.3)" />
              )}
            </Pressable>
            )
          })}
        </ScrollView>
      </View>
    );
  }


  // ─── Message Feed View ───
  if (view === 'feed' && selectedChannel) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => { setView('channels'); setSelectedChannel(null); }}>
            <Ionicons name="chevron-back" size={16} color="#003399" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedChannel.channel_name.toUpperCase()}
          </Text>
          <Pressable onPress={triggerPoll} disabled={isPolling}>
            <Ionicons name={isPolling ? "sync" : "refresh"} size={14} color="#003399" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.feedList} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#003399" style={{ marginTop: 20 }} />
          ) : messages.length > 0 ? (
            messages.map((msg) => {
              // Parse media URLs - could be single URL or JSON array
              let imageUrls: string[] = [];
              if (msg.media_url && (msg.media_type === 'photo' || msg.media_type === 'photo_album')) {
                try {
                  const parsed = JSON.parse(msg.media_url);
                  if (Array.isArray(parsed)) {
                    imageUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0);
                  }
                  else imageUrls = [msg.media_url];
                } catch {
                  imageUrls = [msg.media_url];
                }
              }

              return (
              <View key={msg.id} style={styles.msgCard}>
                {imageUrls.length > 0 && (
                  <View style={imageUrls.length > 1 ? styles.msgImageGrid : undefined}>
                    {imageUrls.map((url, idx) => (
                      <TelegramImage
                        key={`${url}-${idx}`}
                        uri={url}
                        isGrid={imageUrls.length > 1}
                        onOpen={() => setExpandedImage(url)}
                      />
                    ))}
                  </View>
                )}
                {msg.message_text ? (
                  <Text style={styles.msgText} numberOfLines={4}>{msg.message_text}</Text>
                ) : null}
                <View style={styles.msgFooter}>
                  <Text style={styles.msgTime}>{formatTime(msg.sent_at)}</Text>
                  <View style={styles.msgActions}>
                    {msg.media_url ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Pressable
                          style={styles.saveBtn}
                          onPress={() => { setSavingMessageId(msg.id); setView('select_subject'); }}
                          disabled={savingSubject !== null}
                        >
                          <Ionicons name="download-outline" size={14} color="#003399" />
                          <Text style={styles.saveBtnText}>SAVE</Text>
                        </Pressable>
                        {msg.saved_to_subject && (
                          <View style={styles.savedBadge}>
                            <Ionicons name="checkmark" size={8} color="#003399" />
                            <Text style={styles.savedBadgeText}>SAVED IN {msg.saved_to_subject.slice(0, 8).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            )})
          ) : (
            <Text style={styles.emptyText}>NO MESSAGES YET. TAP REFRESH.</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ─── Channel List View (Default) ───
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose}>
          <Ionicons name="chevron-back" size={16} color="#003399" />
        </Pressable>
        <Text style={styles.headerTitle}>TELEGRAM</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={triggerPoll} disabled={isPolling} style={styles.headerBtn}>
            <Ionicons name={isPolling ? "sync" : "refresh"} size={12} color="#003399" />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.channelList} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#003399" style={{ marginTop: 20 }} />
        ) : channels.length > 0 ? (
          channels.map((ch) => (
            <Pressable
              key={ch.id}
              style={styles.channelRow}
              onPress={() => loadMessages(ch)}
            >
              <View style={styles.channelAvatar}>
                {ch.channel_photo_url ? (
                  <ExpoImage source={{ uri: ch.channel_photo_url }} style={styles.channelAvatarImg} />
                ) : (
                  <Text style={styles.channelAvatarText}>{ch.channel_name[0]?.toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.channelName} numberOfLines={1}>{ch.channel_name.toUpperCase()}</Text>
                <Text style={styles.channelMeta}>
                  @{ch.channel_username || '?'} • {ch.message_count || 0} MSGS
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color="#003399" />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>NO CHANNELS TRACKED</Text>
            <Text style={styles.emptyHint}>ADD CHANNELS VIA WEB APP</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Expose keyboard handler for addChannel ───
export const CasioTelegramHandle = {
  // This will be managed via state lifting
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,51,153,0.15)',
  },
  headerTitle: {
    fontFamily: 'DotGothic16',
    fontSize: 14,
    fontWeight: '900',
    color: '#003399',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerBtn: {
    padding: 2,
  },

  // Channel List
  channelList: {
    padding: 6,
    gap: 3,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,51,153,0.3)',
    borderRadius: 4,
    gap: 8,
  },
  channelAvatar: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'rgba(0,51,153,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelAvatarImg: {
    width: 24,
    height: 24,
  },
  channelAvatarText: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    fontWeight: '900',
    color: '#003399',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontFamily: 'DotGothic16',
    fontSize: 14,
    fontWeight: '900',
    color: '#003399',
  },
  channelMeta: {
    fontFamily: 'DotGothic16',
    fontSize: 9,
    color: 'rgba(0,51,153,0.5)',
  },

  // Feed
  feedList: {
    padding: 6,
    gap: 6,
  },
  msgCard: {
    borderWidth: 1,
    borderColor: 'rgba(0,51,153,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  msgImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 3,
    gap: 3,
  },
  msgImageGridItem: {
    width: '49%',
    aspectRatio: 1,
  },
  msgImageSingle: {
    padding: 3,
  },
  msgImageThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(0,51,153,0.04)',
  },
  msgImageFull: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    backgroundColor: 'rgba(0,51,153,0.04)',
  },
  msgImagePlaceholderGrid: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(0,51,153,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  msgImagePlaceholderFull: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    backgroundColor: 'rgba(0,51,153,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  msgImagePlaceholderText: {
    fontFamily: 'DotGothic16',
    fontSize: 8,
    color: 'rgba(0,51,153,0.55)',
  },
  msgText: {
    fontFamily: 'DotGothic16',
    fontSize: 11,
    color: '#003399',
    padding: 5,
    lineHeight: 16,
  },
  msgFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,51,153,0.06)',
  },
  msgTime: {
    fontFamily: 'DotGothic16',
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(0,51,153,0.8)',
  },
  msgActions: {
    flexDirection: 'row',
    gap: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,51,153,0.3)',
    borderRadius: 4,
  },
  saveBtnText: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    fontWeight: '900',
    color: '#003399',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(0,51,153,0.08)',
    borderRadius: 2,
  },
  savedBadgeText: {
    fontFamily: 'DotGothic16',
    fontSize: 8,
    color: '#003399',
  },
  subjectDropdown: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    backgroundColor: '#c5d4c0',
    borderWidth: 1,
    borderColor: 'rgba(0,51,153,0.2)',
    borderRadius: 3,
    padding: 2,
    zIndex: 50,
    minWidth: 100,
    marginBottom: 2,
  },
  subjectOption: {
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  subjectOptionText: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    color: '#003399',
    fontWeight: '900',
  },


  // Empty states
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 4,
  },
  emptyText: {
    fontFamily: 'DotGothic16',
    fontSize: 12,
    color: 'rgba(0,51,153,0.4)',
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    color: 'rgba(0,51,153,0.3)',
  },

  // Expanded image
  expandedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(133, 167, 143, 0.95)',
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 101,
    padding: 4,
  },
  expandedImage: {
    width: '95%',
    height: '85%',
  },
});
