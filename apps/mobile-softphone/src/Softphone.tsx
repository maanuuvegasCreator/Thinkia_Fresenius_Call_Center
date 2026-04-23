import { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  Grid3x3,
  Users,
  User,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ArrowRight,
  Circle,
} from 'lucide-react';
import { Button } from '@shared/app/components/ui/button';
import { Avatar, AvatarFallback } from '@shared/app/components/ui/avatar';

interface Contact {
  id: string;
  name: string;
  phone: string;
  company?: string;
}

interface Call {
  id: string;
  name: string;
  phone: string;
  time: string;
  type: 'inbound' | 'outbound' | 'missed';
  duration?: string;
}

const mockContacts: Contact[] = [
  { id: '1', name: 'María López García', phone: '+34 607 89 43 01', company: 'Fresenius Medical Care' },
  { id: '2', name: 'Laura Sánchez', phone: '+34 691 23 45 67', company: 'Fresenius Medical Care' },
  { id: '3', name: 'Juan Torres Ruiz', phone: '+34 983 66 05 55', company: 'Fresenius Medical Care' },
  { id: '4', name: 'Pedro Ramírez', phone: '+34 678 90 12 34', company: 'Fresenius Medical Care' },
  { id: '5', name: 'Elena Fernández', phone: '+34 689 01 23 45', company: 'Fresenius Medical Care' },
];

const mockCalls: Call[] = [
  { id: '1', name: 'María López García', phone: '+34 607 89 43 01', time: '03:03 pm', type: 'inbound', duration: '3:24' },
  { id: '2', name: 'Laura Sánchez', phone: '+34 691 23 45 67', time: '02:45 pm', type: 'outbound', duration: '1:12' },
  { id: '3', name: 'Juan Torres Ruiz', phone: '+34 983 66 05 55', time: '02:30 pm', type: 'missed' },
  { id: '4', name: 'Pedro Ramírez', phone: '+34 678 90 12 34', time: '01:15 pm', type: 'outbound', duration: '5:47' },
  { id: '5', name: 'Elena Fernández', phone: '+34 689 01 23 45', time: '11:03 am', type: 'inbound', duration: '2:15' },
];

const dialpadButtons = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export function Softphone() {
  const [activeTab, setActiveTab] = useState<'calls' | 'dialpad' | 'contacts' | 'profile'>('dialpad');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [currentContact, setCurrentContact] = useState<{ name: string; phone: string; company?: string } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isInCall && !isOnHold) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isInCall, isOnHold]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleCall = (name: string, phone: string, company?: string) => {
    setCurrentContact({ name, phone, company });
    setIsInCall(true);
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setIsInCall(false);
    setCurrentContact(null);
    setPhoneNumber('');
    setCallDuration(0);
    setIsMuted(false);
    setIsOnHold(false);
    setIsRecording(false);
    setShowInCallKeypad(false);
  };

  const handleDialpadDigit = (digit: string) => {
    setPhoneNumber(phoneNumber + digit);
  };

  const missedCallsCount = mockCalls.filter((call) => call.type === 'missed').length;

  const CallTypeIcon = ({ type }: { type: Call['type'] }) => {
    if (type === 'inbound') return <PhoneIncoming className="h-4 w-4 text-green-600" />;
    if (type === 'outbound') return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
    return <PhoneMissed className="h-4 w-4 text-red-600" />;
  };

  if (isInCall && currentContact) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div className="px-4 py-3 flex items-center justify-center border-b bg-white/80">
          <h1 className="text-lg font-semibold text-gray-900">En llamada</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <Avatar className="h-24 w-24 mb-6">
            <AvatarFallback className="text-2xl font-semibold" style={{ backgroundColor: '#E6EBF5', color: '#001963' }}>
              {getInitials(currentContact.name)}
            </AvatarFallback>
          </Avatar>

          <h2 className="text-2xl font-semibold text-gray-900 mb-1">{currentContact.name}</h2>
          <p className="text-sm text-gray-500 mb-2">{currentContact.phone}</p>
          {currentContact.company && <p className="text-xs text-gray-400">{currentContact.company}</p>}

          <div className="mt-8 flex items-center gap-2">
            <Circle className="h-3 w-3 fill-green-500 text-green-500 animate-pulse" />
            <span className="text-lg font-medium text-gray-700">{isOnHold ? 'En espera' : formatDuration(callDuration)}</span>
          </div>
        </div>

        {showInCallKeypad && (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
              {dialpadButtons.map((button) => (
                <button
                  key={button.digit}
                  type="button"
                  onClick={() => handleDialpadDigit(button.digit)}
                  className="flex flex-col items-center justify-center h-16 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl font-semibold text-gray-900">{button.digit}</span>
                  {button.letters && <span className="text-xs text-gray-500 mt-0.5">{button.letters}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 pb-8">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button type="button" onClick={() => setIsMuted(!isMuted)} className="flex flex-col items-center gap-2">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500' : 'bg-gray-200'}`}>
                {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-gray-700" />}
              </div>
              <span className="text-xs text-gray-600">Mute</span>
            </button>

            <button type="button" onClick={() => setIsOnHold(!isOnHold)} className="flex flex-col items-center gap-2">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${isOnHold ? 'bg-yellow-500' : 'bg-gray-200'}`}>
                {isOnHold ? <Play className="h-6 w-6 text-white" /> : <Pause className="h-6 w-6 text-gray-700" />}
              </div>
              <span className="text-xs text-gray-600">Hold</span>
            </button>

            <button type="button" onClick={() => setShowInCallKeypad(!showInCallKeypad)} className="flex flex-col items-center gap-2">
              <div
                className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
                  showInCallKeypad ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              >
                <Grid3x3 className={`h-6 w-6 ${showInCallKeypad ? 'text-white' : 'text-gray-700'}`} />
              </div>
              <span className="text-xs text-gray-600">Teclado</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <button type="button" onClick={() => setIsRecording(!isRecording)} className="flex flex-col items-center gap-2">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-red-500' : 'bg-gray-200'}`}>
                <Circle className={`h-6 w-6 ${isRecording ? 'text-white fill-white animate-pulse' : 'text-gray-700'}`} />
              </div>
              <span className="text-xs text-gray-600">Recording</span>
            </button>

            <button type="button" onClick={handleEndCall} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center transition-colors">
                <PhoneOff className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs text-gray-600">Colgar</span>
            </button>

            <button type="button" className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-gray-700" />
              </div>
              <span className="text-xs text-gray-600">Transferir</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white" style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div className="border-b bg-white px-4 py-3 flex items-center justify-center">
        <h1 className="text-lg font-semibold text-gray-900">Softphone</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'calls' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <h1 className="text-xl font-semibold mb-4">Llamadas</h1>

              <div className="flex gap-2">
                <button type="button" className="px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white">
                  Todas
                </button>
                <button type="button" className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                  Perdidas
                  {missedCallsCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs">{missedCallsCount}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {mockCalls.map((call) => (
                <div
                  key={call.id}
                  role="button"
                  tabIndex={0}
                  className="px-4 py-3 border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleCall(call.name, call.phone)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCall(call.name, call.phone);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <CallTypeIcon type={call.type} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{call.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{call.phone}</span>
                        {call.duration && (
                          <>
                            <span>•</span>
                            <span>{call.duration}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{call.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'dialpad' && (
          <div className="h-full flex flex-col p-6">
            <div className="text-center mb-8">
              <input
                type="text"
                value={phoneNumber}
                readOnly
                placeholder="Introduce un número"
                className="text-3xl font-light text-center w-full bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
              />
            </div>

            <div className="flex-1 flex flex-col justify-center max-w-xs mx-auto w-full">
              <div className="grid grid-cols-3 gap-4 mb-8">
                {dialpadButtons.map((button) => (
                  <button
                    key={button.digit}
                    type="button"
                    onClick={() => handleDialpadDigit(button.digit)}
                    className="flex flex-col items-center justify-center h-20 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  >
                    <span className="text-3xl font-light text-gray-900">{button.digit}</span>
                    {button.letters && <span className="text-xs text-gray-500 mt-1">{button.letters}</span>}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => phoneNumber && handleCall('Unknown', phoneNumber)}
                disabled={!phoneNumber}
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: phoneNumber ? '#00A884' : '#e5e7eb' }}
              >
                <Phone className={`h-7 w-7 ${phoneNumber ? 'text-white' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <h1 className="text-xl font-semibold">Contactos</h1>
            </div>

            <div className="flex-1 overflow-y-auto">
              {mockContacts.map((contact) => (
                <div
                  key={contact.id}
                  role="button"
                  tabIndex={0}
                  className="px-4 py-3 border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleCall(contact.name, contact.phone, contact.company)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCall(contact.name, contact.phone, contact.company);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback style={{ backgroundColor: '#E6EBF5', color: '#001963' }}>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{contact.name}</p>
                      <p className="text-xs text-gray-500 truncate">{contact.phone}</p>
                      {contact.company && <p className="text-xs text-gray-400 truncate">{contact.company}</p>}
                    </div>
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-full text-white"
                      style={{ backgroundColor: '#00A884' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCall(contact.name, contact.phone, contact.company);
                      }}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <h1 className="text-xl font-semibold">Mi perfil</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col items-center mb-8">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarFallback className="text-2xl" style={{ backgroundColor: '#E6EBF5', color: '#001963' }}>
                    PC
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-semibold">Pedro Castro</h2>
                <p className="text-sm text-gray-500">pedro.castro@fresenius.es</p>
                <p className="text-sm text-gray-400">+34 607 89 43 01</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">Estado</p>
                  <p className="text-sm text-gray-900">Disponible</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">Departamento</p>
                  <p className="text-sm text-gray-900">Atención al Cliente</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">Rol</p>
                  <p className="text-sm text-gray-900">Agente Principal</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-4 gap-1 p-2">
          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`relative flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${activeTab === 'calls' ? 'text-blue-600' : 'text-gray-600'}`}
          >
            <PhoneCall className="h-5 w-5" />
            <span className="text-xs font-medium">Llamadas</span>
            {missedCallsCount > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-6 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {missedCallsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dialpad')}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${activeTab === 'dialpad' ? 'text-blue-600' : 'text-gray-600'}`}
          >
            <Grid3x3 className="h-5 w-5" />
            <span className="text-xs font-medium">Teclado</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${activeTab === 'contacts' ? 'text-blue-600' : 'text-gray-600'}`}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">Contactos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-600'}`}
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Mi perfil</span>
          </button>
        </div>
      </div>
    </div>
  );
}
