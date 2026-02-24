import { Module } from '@nestjs/common';
import { ProcessingService } from './processing.service';
import { TranscriptionService } from './transcription.service';
import { SummarizationService } from './summarization.service';
import { VectorizationService } from './vectorization.service';
import { ChatService } from './chat.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [
    ProcessingService,
    TranscriptionService,
    SummarizationService,
    VectorizationService,
    ChatService,
  ],
  exports: [ProcessingService, VectorizationService, ChatService],
})
export class ProcessingModule {}
